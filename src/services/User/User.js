const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const yup = require('yup');
const User = require('../../models/user/User');
const { sendFriendRequest } = require('./Friends');
const {
  uploadProfileVideo, deleteFile, tmpCleanup, getFileSignedHeaders,
} = require('../../helpers');
const Posts = require('../../models/posts/Posts');

const loginUser = async (identifier, password) => {
  const JWT_SECRET = process.env.TOKEN_SECRET;
  if (!identifier || !password) {
    throw new Error('Identifier or password is missing.');
  }
  const user = await User.findOne({
    $or:
     [{ email: identifier }, { username: identifier }],
  });

  if (!user) {
    const error = new Error('An account with that identifier does not exist');
    error.exists = true;
    throw error;
  }

  if (await bcrypt.compare(password, user.password)) {
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      JWT_SECRET,
    );

    return { token, userId: user._id };
  }

  throw new Error('Invalid email/password');
};

const registerUser = async ({
  username, email, plainTextPassword, firstName, lastName, file, notificationToken,
}) => {
  if (!file) {
    throw new Error('No video profile provided');
  }

  const schema = yup.object().shape({
    firstName: yup.string().required(),
    lastName: yup.string().required(),
    email: yup.string().email().required(),
    password: yup.string().required('No password provided.')
      .min(8, 'Password is too short - should be 8 chars minimum.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/, 'Password is not secure enough.'),
    username: yup.string().required(),
    notificationToken: yup.string().required(),
  });

  await schema.validate({
    username, firstName, lastName, email, password: plainTextPassword, notificationToken,
  }).catch((err) => {
    if (err.errors?.length) {
      throw new Error(err.errors[0]);
    }
  });

  if (!username || typeof username !== 'string') {
    throw new Error('Username is missing or invalid.');
  }

  // $or is unreliable so need to make two queries
  const emailExists = await User.findOne({ emailLowered: email.toLowerCase() });

  const usernameExists = await User.findOne({ usernameLowered: username.toLowerCase() });

  if (emailExists || usernameExists) {
    const message = emailExists && usernameExists ? 'An account with that email and username combination already exists.' : `An account with that ${emailExists ? 'email' : 'username'}`;
    const error = new Error(message);
    error.validationErrors = {
      email: { exists: emailExists },
      username: { exists: usernameExists },
    };
    throw error;
  }

  if (!plainTextPassword || typeof plainTextPassword !== 'string') {
    throw new Error("'Invalid password'");
  }

  if (plainTextPassword.length < 8) {
    throw new Error('Password needs to be longer');
  }

  const password = await bcrypt.hash(plainTextPassword, 10);

  const { profileVideoUrl, profileGifUrl } = await uploadProfileVideo(file);

  if (!profileVideoUrl || !profileGifUrl) {
    throw new Error('Profile video not uploaded');
  }
  await User.create({
    username,
    usernameLowered: username.toLowerCase(),
    email,
    emailLowered: email.toLowerCase(),
    password,
    firstName,
    lastName,
    profileVideoUrl,
    profileGifUrl,
    notificationToken,
  });
  return { registered: true, profileVideoUrl };
};

const resetUserPassword = async (req, res) => {
  try {
    const { resetToken, password, passwordCheck } = req.body;
    // if there is a user with that token, just remove the token and return the user
    const user = await User.findOneAndUpdate(
      { resetToken },
      {
        $set: {
          resetToken: '',
        },
      },
    );

    // no user found so we throw and error
    if (user === null) {
      throw new Error('Invalid token.');
    }

    // also we throw an error if it's too late
    if (Date.now() > user.expireToken) {
      throw new Error('Reset password link expired.');
    }

    // check of password match
    if (password !== passwordCheck) {
      throw new Error("Passwords don't match.");
    }

    const salt = await bcrypt.genSalt();
    const {
      _id, firstName, timeZone, adminLevel,
    } = user;
    const token = jwt.sign({ id: user._id }, process.env.TOKEN_SECRET, {
      expiresIn: '30d',
    });

    user.set({
      password: await bcrypt.hash(password, salt),
      expireToken: 0,
      resetToken: '',
      verified: !user.verified && !user.phoneNumber
        ? new Date()
        : undefined,
    });
    user.save();

    res.status(200).json({
      success: true,
      message: 'Password was changed',
      data: {
        token,
        user: {
          _id,
          firstName,
          timeZone,
          adminLevel,
        },
      },
    });
  } catch (e) {
    res.status(200).json({
      success: false,
      message: "Can't reset your password!",
      error: e.message,
    });
  }
};

const createUserPasswordReset = async (req, res) => {
  try {
    const { email } = req.params;
    // random token to identify the user
    const resetToken = crypto.randomBytes(16).toString('hex');
    const user = await User.findOneAndUpdate(
      { emailLowered: email.toLowerCase() },
      {
        $set: {
          resetToken,
          expireToken: Date.now() + 86400000,
        },
      },
    );

    if (user === null) {
      throw new Error(
        'No user registered to that email has been found.',
      );
    }

    // await sgMail.send({
    //     to: email,
    //     from: 'no-reply@realestateu.email',
    //     subject: 'Password reset',
    //     html: `
    //         <p>You requested a password reset.</p>
    //         <h5>Click  <a href="${process.env.FRONTEND_URL}/change-password?resetToken=${resetToken}">HERE</a>  to reset password.</h5>
    //     `,
    // });

    console.log({
      to: email,
      from: 'no-reply@realestateu.email',
      subject: 'Password reset',
      html: `
                    <p>You requested a password reset.</p>
                    <h5>Click  <a href="http://localhost:3000/change-password?resetToken=${resetToken}">HERE</a>  to reset password.</h5>
                `,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset email has been sent!',
      data: '',
    });
  } catch (e) {
    res.status(200).json({
      success: false,
      message: "Can't reset user password!",
      error: e.message,
    });
  }
};

const getUserData = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }

  return {
    ...user.toObject(),
    numberOfFriends: user.numberOfFriendsAsRequester + user.numberOfFriendsAsReceiver,
    password: '',
    profileVideoHeaders: getFileSignedHeaders(user.profileVideoUrl),
  };
};

const updateUserDetails = async ({ userId, file, details }) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User could not be found.');
  }

  if (details && typeof details !== 'object') {
    throw new Error('Invalid Details.');
  }

  const schema = yup.object().shape({
    firstName: yup.string(),
    lastName: yup.string(),
    email: yup.string().email(),
    password: yup.string().min(8, 'Password is too short - should be 8 chars minimum.')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/, 'Password is not secure enough.'),
    username: yup.string(),
    notificationToken: yup.string(),
  });

  await schema.validate(details).catch((err) => {
    if (err.errors?.length) {
      throw new Error(err.errors[0]);
    }
  });

  if (details.username) {
    const usernameLowered = details.username.toLowerCase();

    const exists = await User.findOne({ usernameLowered });

    if (exists && exists._id.toString() !== user._id.toString()) {
      const error = new Error('A user exists with that username.');
      error.validationErrors = { username: { exists: true } };
      throw error;
    }
    details.usernameLowered = details.username.toLowerCase();
  }

  if (details.email) {
    const exists = await User.findOne({ emailLowered: details.email.toLowerCase() });
    if (exists && exists._id.toString() !== user._id.toString()) {
      const error = new Error('A user exists with that email address.');
      error.validationErrors = { email: { exists: true } };
      throw error;
    }
    details.emailLowered = details.email.toLowerCase();
  }

  if (file) {
    const currentProfileGifUrl = user.profileGifUrl;
    const currentProfileVideoUrl = user.profileVideoUrl;

    const gifUrlIndex = currentProfileGifUrl.lastIndexOf('/');
    const videoUrlIndex = currentProfileVideoUrl.lastIndexOf('/');

    const currentProfileGifKey = currentProfileGifUrl.substring(gifUrlIndex + 1);
    const currentProfileVideoKey = currentProfileVideoUrl.substring(videoUrlIndex + 1);
    const { profileVideoUrl, profileGifUrl } = await uploadProfileVideo(file);
    await User.findByIdAndUpdate(userId, {
      ...details,
      profileVideoUrl,
      profileGifUrl,
    });
    if (profileVideoUrl && profileGifUrl) {
      await Promise.allSettled([
        deleteFile(currentProfileGifKey),
        deleteFile(currentProfileVideoKey),
        tmpCleanup(currentProfileVideoKey),
      ]);
    }
    return {
      ...user.toObject(),
      ...details,
      profileVideoUrl,
      profileGifUrl,
      profileVideoHeaders: getFileSignedHeaders(profileVideoUrl),
    };
  }
  if (details.password) {
    const password = await bcrypt.hash(details.password, 10);
    await User.findByIdAndUpdate(userId, { ...details, password });

    return {
      ...user.toObject(),
      ...details,
      profileVideoHeaders: getFileSignedHeaders(user.profileVideoUrl),
    };
  }
  await User.findByIdAndUpdate(userId, details);

  return {
    ...user.toObject(),
    ...details,
    profileVideoHeaders: getFileSignedHeaders(user.profileVideoUrl),
  };
};

const checkUserExists = async ({ type, identifier, userId }) => {
  const user = userId ? await User.findById(userId) : null;
  if (!identifier) {
    throw new Error('No identifier provided.');
  }
  const query = type === 'email' ? { emailLowered: identifier.toLowerCase() } : { usernameLowered: identifier.toLowerCase() };

  const exists = await User.findOne(query);

  if (user?.[`${type}Lowered`] === identifier.toLowerCase()) {
    return { [type]: { exists: false } };
  }

  if (exists) {
    return { [type]: { exists: true } };
  }

  return { [type]: { exists: false } };
};

const generateData = async ({
  username, email, plainTextPassword, firstName, lastName, notificationToken,
}) => {
  const schema = yup.object().shape({
    firstName: yup.string().required(),
    lastName: yup.string().required(),
    email: yup.string().email().required(),
    password: yup.string().required(),
    username: yup.string().required(),
    notificationToken: yup.string().required(),
  });

  await schema.validate({
    username, firstName, lastName, email, password: plainTextPassword, notificationToken,
  }).catch((err) => {
    if (err.errors?.length) {
      throw new Error(err.errors[0]);
    }
  });

  if (!username || typeof username !== 'string') {
    throw new Error('Username is missing or invalid.');
  }

  // $or is unreliable so need to make two queries
  const emailExists = await User.findOne({ emailLowered: email.toLowerCase() });

  const usernameExists = await User.findOne({ usernameLowered: username.toLowerCase() });

  if (emailExists || usernameExists) {
    const message = emailExists && usernameExists ? 'An account with that email and username combination already exists.' : `An account with that ${emailExists ? 'email' : 'username'}`;
    const error = new Error(message);
    error.validationErrors = {
      email: { exists: emailExists },
      username: { exists: usernameExists },
    };
    throw error;
  }

  if (!plainTextPassword || typeof plainTextPassword !== 'string') {
    throw new Error("'Invalid password'");
  }

  if (plainTextPassword.length < 8) {
    throw new Error('Password needs to be longer');
  }

  const password = await bcrypt.hash(plainTextPassword, 10);

  const profileVideoUrl = 'https://i-am-app-test.s3.eu-west-2.amazonaws.com/profileVideos/8faf155b-8be2-4361-99e8-f2bf43b2a74f.mp4';
  const profileGifUrl = 'https://i-am-app-test.s3.eu-west-2.amazonaws.com/profileGifs/8faf155b-8be2-4361-99e8-f2bf43b2a74f.gif';

  if (!profileVideoUrl || !profileGifUrl) {
    throw new Error('Profile video not uploaded');
  }
  const user = await User.create({
    username,
    usernameLowered: username.toLowerCase(),
    email,
    emailLowered: email.toLowerCase(),
    password,
    firstName,
    lastName,
    profileVideoUrl,
    profileGifUrl,
    notificationToken,
  });
  const imageArray = ['https://images.unsplash.com/photo-1478265409131-1f65c88f965c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=870&q=80',
    'https://images.unsplash.com/photo-1414541944151-2f3ec1cfd87d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1748&q=80',
    'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80',
    'https://images.unsplash.com/photo-1547754980-3df97fed72a8?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8MTR8fHNub3d8ZW58MHx8MHx8&auto=format&fit=crop&w=800&q=60',
  ];
  const bodyArray = ['Hello',
    'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Lorem ipsum dolor sit',
    '',
  ];
  for (let i = 0; i < 2; i += 1) {
    const randomImageIndex = Math.floor(Math.random() * imageArray.length);
    const randomBodyIndex = Math.floor(Math.random() * bodyArray.length);
    const body = bodyArray[randomBodyIndex];
    const post = new Posts({
      body: body || '',
      userId: user.id,
    });
    post.mediaUrl = imageArray[randomImageIndex];
    post.mediaMimeType = 'jpeg';
    post.mediaType = 'image';
    post.mediaIsSelfie = false;

    post.save();
  }

  await sendFriendRequest(user._id, '61d4a62fac871076485409c6');

  return {
    registered: true,
    username,
    usernameLowered: username.toLowerCase(),
    email,
    emailLowered: email.toLowerCase(),
    password,
    firstName,
    lastName,
    profileVideoUrl,
    profileGifUrl,
    notificationToken,
  };
};

module.exports = {
  loginUser,
  registerUser,
  resetUserPassword,
  createUserPasswordReset,
  getUserData,
  updateUserDetails,
  checkUserExists,
  generateData,
};
