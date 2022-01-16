const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const yup = require('yup');
const User = require('../../models/user/User');

const {
  uploadProfileVideo, validateEmail, deleteFile, tmpCleanup, getFileSignedHeaders,
} = require('../../helpers');

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

const updateUserProfile = async ({ userId, file, details }) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User could not be found.');
  }

  if (details && typeof details !== 'object') {
    throw new Error('Invalid Details.');
  }

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

  if (details.password) {
    if (details.password.length < 8) {
      throw new Error('Password is not long enough.');
    }
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
      // usernameLowered: details.username.toLowerCase(),
      // emailLowered: details.email.toLowerCase(),
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
  username, email, plainTextPassword, firstName, lastName, file, notificationToken,
}) => {
  if (!file) {
    throw new Error('No video profile provided');
  }

  const validEmail = validateEmail(email);

  const schema = yup.object().shape({
    firstName: yup.string().required(),
    lastname: yup.string().required(),
    email: yup.string().email(),
    password: yup.string().required(),
    username: yup.string().required,
  });

  schema
    .isValid({
      name: 'jimmy',
      age: 24,
    })
    .then((valid) => {
      // valid; // => true
      console.log(valid);
    }).catch((err) => { throw err; });

  if (!username || typeof username !== 'string') {
    throw new Error('Username is missing or invalid.');
  }

  if (!email || !validEmail || typeof email !== 'string') {
    throw new Error('Email is missing or invalid');
  }

  if (!notificationToken) {
    throw new Error('Notification token is required.');
  }

  if (!firstName) {
    throw new Error('Firstname is required.');
  }

  if (!lastName) {
    throw new Error('Lastname is required.');
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

module.exports = {
  loginUser,
  registerUser,
  resetUserPassword,
  createUserPasswordReset,
  getUserData,
  updateUserProfile,
  checkUserExists,
  generateData,
};
