const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');
const { S3 } = require('aws-sdk');
const User = require('../../models/user/User');
const { validateEmail } = require('../../helpers');

const awsConnection = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-2',
});
const Bucket = 'chat-app-for-learning';
const loginUser = async (identifier, password) => {
  const JWT_SECRET = process.env.TOKEN_SECRET;
  // const user = await User.findOne({ email }).lean();

  const user = await User.findOne({
    $or:
     [{ email: identifier }, { username: identifier }],
  }).lean();

  if (!user) {
    throw new Error('user could not be found');
  }

  if (await bcrypt.compare(password, user.password)) {
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      JWT_SECRET,
    );

    return { token };
  }

  throw new Error('Invalid email/password');
};

const registerUser = async ({
  username, email, plainTextPassword, firstName, lastName, file,
}) => {
  //   if (!file) {
  //     throw new Error('No video profile provided');
  //   }
  const re = /(?:\.([^.]+))?$/;
  //   const fileExtension = re.exec(file.originalname)[1];
  //   const params = {
  //     Bucket,
  //     Key: `${uuid()}.${fileExtension}`,
  //     Body: file.buffer,
  //   };

  const validEmail = validateEmail(email);

  if (!username || typeof username !== 'string') {
    throw new Error('Username is missing or invalid.');
  }

  if (!email || !validEmail || typeof email !== 'string') {
    throw new Error('Email is missing or invalid');
  }
  // const exists = await User.exists({ email });
  const exists = await User.findOne({ $or: [{ email }, { username }] });
  if (exists) {
    const error = new Error('an account with that email already exists');
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

  //   awsConnection.putObject(params, (AWSErr, pres) => {
  //     if (AWSErr) {
  //       throw new Error(AWSErr);
  //     }
  //   });
  //   const profileVideoUrl = awsConnection.getSignedUrl('getObject', { Bucket: params.Bucket, Key: params.Key });
  //   if (profileVideoUrl) {
  await User.create({
    username,
    email,
    password,
    firstName,
    lastName,
    profileVideoUrl: 'ddd',
  });
  return { registered: true };
  //   }

  throw new Error('Profile video url could not be generated');
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

module.exports = {
  loginUser,
  registerUser,
  resetUserPassword,
  createUserPasswordReset,
};
