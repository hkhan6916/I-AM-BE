const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/user/User');
const {
  uploadProfileVideo, validateEmail, deleteFile, tmpCleanup,
} = require('../../helpers');

const loginUser = async (identifier, password) => {
  const JWT_SECRET = process.env.TOKEN_SECRET;
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

  const validEmail = validateEmail(email);

  if (!username || typeof username !== 'string') {
    throw new Error('Username is missing or invalid.');
  }

  if (!email || !validEmail || typeof email !== 'string') {
    throw new Error('Email is missing or invalid');
  }

  if (!notificationToken) {
    throw new Error('Notification token is required.');
  }
  // $or is unreliable so need to make two queries
  const emailExists = await User.findOne({ email });
  const usernameExists = await User.findOne({ username });

  if (emailExists || usernameExists) {
    const error = new Error('an account with that email and username combination already exists');
    error.exists = true;
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
    email,
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
      { email },
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

  return user;
};

const updateUserProfile = async ({ userId, file, details }) => {
  if (!details && !file) {
    throw new Error('No details provided.');
  }

  if (details && typeof details !== 'object') {
    throw new Error('Invalid Details.');
  }

  const user = await User.findById(userId);

  if (file) {
    const currentProfileGifUrl = user.profileGifUrl;
    const currentProfileVideoUrl = user.profileVideoUrl;

    const gifUrlIndex = currentProfileGifUrl.lastIndexOf('/');
    const videoUrlIndex = currentProfileVideoUrl.lastIndexOf('/');

    const currentProfileGifKey = currentProfileGifUrl.substring(gifUrlIndex + 1);
    const currentProfileVideoKey = currentProfileVideoUrl.substring(videoUrlIndex + 1);
    const { profileVideoUrl, profileGifUrl } = await uploadProfileVideo(file);
    await User.findByIdAndUpdate(userId, { ...details, profileVideoUrl, profileGifUrl });
    if (profileVideoUrl && profileGifUrl) {
      await Promise.allSettled([deleteFile(currentProfileGifKey),
        deleteFile(currentProfileVideoKey), tmpCleanup(currentProfileVideoKey)]);
    }
    return {
      ...user.toObject(), ...details, profileVideoUrl, profileGifUrl,
    };
  }
  await User.findByIdAndUpdate(userId, details);

  return { ...user.toObject(), ...details };
};

module.exports = {
  loginUser,
  registerUser,
  resetUserPassword,
  createUserPasswordReset,
  getUserData,
  updateUserProfile,
};
