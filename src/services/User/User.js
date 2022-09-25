const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { object, string, boolean } = require('yup');
const sgMail = require('@sendgrid/mail');
const { nanoid } = require('nanoid');
const User = require('../../models/user/User');
const {
  deleteFile, getFileSignedHeaders, deleteMultipleFiles,
} = require('../../helpers');
const Posts = require('../../models/posts/Posts');
const UserJobHistory = require('../../models/user/JobHIstory');
const UserEducationHistory = require('../../models/user/EducationHIstory');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');
const UserReports = require('../../models/user/UserReports');
const BlockedUsers = require('../../models/user/BlockedUsers');
const { removeConnection } = require('./Friends');
const getSignedUploadS3Url = require('../../helpers/getSignedUploadS3Url');
const passwordResetTemplate = require('../../emailTemplates/PasswordReset');
const emailVerificationTemplate = require('../../emailTemplates/EmailVerification');

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

    const profileVideoKey = user.profileVideoUrl?.substring(user.profileVideoUrl.lastIndexOf('profileVideos'));
    const userData = {
      ...user.toObject(),
      numberOfFriends: user.numberOfFriendsAsRequester + user.numberOfFriendsAsReceiver,
      password: '',
      profileVideoUrl: getCloudfrontSignedUrl(profileVideoKey),
      profileImageHeaders: getFileSignedHeaders(user.profileImageUrl),
    };
    const response = {
      token, userId: user._id, apiKeys: { tenorApiKey: process.env.TENOR_API_KEY }, userData,
    };
    return response;
  }

  throw new Error('Invalid email/password');
};

const verifyRegisterationDetails = async ({
  username, email, plainTextPassword, firstName, lastName, notificationToken, jobTitle, profileVideoFileName, profileGifFileName, profileImageFileName,
}) => {
  const profileVideoExtension = profileVideoFileName?.split('.').pop();
  const profileImageExtension = profileImageFileName?.split('.').pop();
  const profileGifExtension = profileGifFileName?.split('.').pop();

  // if file has not extension e.g. nothing after '.'
  if (profileVideoFileName && profileVideoFileName === profileVideoExtension) {
    throw new Error('Profile video file name must have an extension');
  }
  if (profileGifFileName && profileGifExtension !== 'gif') {
    throw new Error(`Profile gif must have the correct file extension. Actual extension was ${profileGifExtension}`);
  }
  if (profileImageFileName && profileImageFileName === profileImageExtension) {
    throw new Error('Profile image file name must have an extension');
  }

  if (profileVideoFileName && !profileGifFileName) {
    throw new Error('A profile gif file name is required when uploading a profile video');
  }

  if (!profileImageFileName && !profileVideoFileName) {
    throw new Error('A profile media file is required');
  }

  const schema = object().shape({
    firstName: string().required(),
    lastName: string().required(),
    email: string().email().required(),
    password: string().required('No password provided.')
      .min(8, 'Password is too short - should be 8 chars minimum.')
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/, 'Password is not secure enough.'),
    username: string().required(),
    notificationToken: string().required(),
    jobTitle: string().required(),
    profileVideoFileName: string(),
    profileImageFileName: string(),
    profileGifFileName: string(),
  });

  await schema.validate({
    username, firstName, lastName, email, password: plainTextPassword, notificationToken, jobTitle, profileVideoFileName, profileImageFileName, profileGifFileName,
  }).catch((err) => {
    if (err.errors?.length) {
      throw new Error(err.errors[0]);
    }
  });

  if (username && username.length < 3) {
    throw new Error('Username is too short');
  }

  if (!username || typeof username !== 'string' || username.split(' ').length > 1) {
    throw new Error('Username is missing or invalid.');
  }

  // $or is unreliable so need to make two queries
  const emailExists = await User.findOne({ emailLowered: email.toLowerCase() });

  const usernameExists = await User.findOne({ usernameLowered: username.toLowerCase() });

  if (emailExists || usernameExists) {
    const message = emailExists && usernameExists ? 'An account with that email and username combination already exists.' : `An account with that ${emailExists ? 'email' : 'username'} already exists.`;
    const error = new Error(message);
    error.validationErrors = {
      email: { exists: !!emailExists },
      username: { exists: !!usernameExists },
    };
    throw error;
  }

  if (!plainTextPassword || typeof plainTextPassword !== 'string') {
    throw new Error("'Invalid password'");
  }

  if (plainTextPassword.length < 8) {
    throw new Error('Password needs to be longer');
  }
  const profileVideoKey = profileVideoFileName && `${username}_${nanoid()}${profileVideoFileName.replace(/\s/g, '')}`;
  const profileImageKey = profileImageFileName && `${username}_${nanoid()}${profileImageFileName.replace(/\s/g, '')}`;
  const profileGifKey = profileGifFileName && `${username}_${nanoid()}${profileGifFileName.replace(/\s/g, '')}`;
  const signedProfileVideoUploadUrl = profileVideoFileName && await getSignedUploadS3Url(`profileVideos/${profileVideoKey}`);
  const signedProfileGifUploadUrl = profileGifFileName && await getSignedUploadS3Url(`profileGifs/${profileGifKey}`);
  const signedProfileImageUploadUrl = profileImageFileName && await getSignedUploadS3Url(`profileImages/${profileImageKey}`);

  if ((profileVideoFileName && !signedProfileVideoUploadUrl) || (profileImageFileName && !signedProfileImageUploadUrl)) {
    throw new Error('Could not generate signed upload url');
  }

  return {
    signedProfileVideoUploadUrl,
    profileVideoKey,
    signedProfileGifUploadUrl: profileGifFileName ? signedProfileGifUploadUrl : null,
    profileGifKey: profileGifFileName ? profileGifKey : null,
    signedProfileImageUploadUrl: !profileVideoFileName ? signedProfileImageUploadUrl : null,
    profileImageKey: !profileVideoFileName ? profileImageKey : null,
  };
};

const registerUser = async ({
  username, email, plainTextPassword, firstName, lastName, notificationToken, jobTitle, flipProfileVideo, profileVideoKey, profileGifKey, profileImageKey,
}) => {
  const schema = object().shape({
    firstName: string().required(),
    lastName: string().required(),
    email: string().email().required(),
    password: string().required('No password provided.')
      .min(8, 'Password is too short - should be 8 chars minimum.')
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/, 'Password is not secure enough.'),
    username: string().required(),
    notificationToken: string().required(),
    jobTitle: string().required(),
  });

  await schema.validate({
    username, firstName, lastName, email, password: plainTextPassword, notificationToken, jobTitle,
  }).catch((err) => {
    if (err.errors?.length) {
      throw new Error(err.errors[0]);
    }
  });

  if (username && username.length < 3) {
    throw new Error('Username is too short');
  }

  if (!username || typeof username !== 'string' || username.split(' ').length > 1) {
    throw new Error('Username is missing or invalid.');
  }

  if (profileVideoKey && !profileGifKey) {
    throw new Error('No profile gif provided.');
  }

  // $or is unreliable so need to make two queries
  const emailExists = await User.findOne({ emailLowered: email.toLowerCase() });

  const usernameExists = await User.findOne({ usernameLowered: username.toLowerCase() });

  if (emailExists || usernameExists) {
    const message = emailExists && usernameExists ? 'An account with that email and username combination already exists.' : `An account with that ${emailExists ? 'email' : 'username'} already exists.`;
    const error = new Error(message);
    error.validationErrors = {
      email: { exists: !!emailExists },
      username: { exists: !!usernameExists },
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

  const profileVideoUrl = profileVideoKey ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/profileVideos/${profileVideoKey}` : '';

  const profileGifUrl = profileGifKey ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/profileGifs/${profileGifKey}` : '';
  const profileImageUrl = profileImageKey ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/profileImages/${profileImageKey}` : '';

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
    profileImageUrl,
    notificationToken,
    jobTitle,
    flipProfileVideo,
    verificationCode: Math.floor(100000 + Math.random() * 900000),
  });
  return { registered: true, profileVideoUrl, profileImageUrl };
};

const createEmailVerification = async (userId) => {
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  if (!userId) throw new Error('No user id provided');

  const user = await User.findByIdAndUpdate(userId, { verificationCode });
  if (!user) throw new Error('A user does not exist with this ID');

  const userObj = user.toObject();

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const msg = emailVerificationTemplate(userObj.email, verificationCode);
  sgMail
    .send(msg)
    .catch(() => {
      throw new Error('Could not send verification email.');
    });
};

const verifyUserEmail = async (userId, verificationCode) => {
  if (!userId) throw new Error('No user id provided');

  const user = await User.findById(userId);
  if (!user) throw new Error('A user does not exist with this ID');

  const userObj = user.toObject();
  if (userObj.verificationCode === verificationCode) {
    user.verified = true;
    user.save();
    return 'Verified';
  }
  throw new Error('Verification codes do not match');
};

const resetUserPassword = async (req, res) => {
  try {
    const { resetToken, password, passwordCheck } = req.body;
    // if there is a user with that token, just remove the token and return the user

    if (!resetToken) {
      throw new Error('Reset token is required');
    }
    const user = await User.findOneAndUpdate(
      { resetToken },
      { resetToken: '' },
    );

    // no user found so we throw and error
    if (!user) {
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
      _id, firstName,
    } = user;
    const token = jwt.sign({ id: user._id }, process.env.TOKEN_SECRET, {
      expiresIn: '30d',
    });

    user.set({
      password: await bcrypt.hash(password, salt),
      expireToken: 0,
      resetToken: '',
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
        },
      },
    });
  } catch (e) {
    res.status(200).json({
      success: false,
      message: e.message,
      data: { invalidToken: e.invalidToken },
    });
  }
};

const createUserPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) throw new Error('No email provided');
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
    if (!user) {
      const error = new Error('No user registered to that email has been found.');
      error.found = false;
      throw error;
    }

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = passwordResetTemplate(email, resetToken);
    sgMail
      .send(msg)
      .catch(() => {
        throw new Error('Could not send reset email.');
      });

    res.status(200).json({
      success: true,
      message: 'Password reset email has been sent.',
    });
  } catch (e) {
    res.status(200).json({
      success: false,
      message: e.message,
      data: { found: e.found },
    });
  }
};

const getUserData = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User does not exist.');
  }
  const profileVideoKey = user.profileVideoUrl.substring(user.profileVideoUrl.lastIndexOf('profileVideos'));
  if (!userId) {
    throw new Error('User id was not provided');
  }

  const userJobHistory = await UserJobHistory.find({
    userId,
  }).limit(5).sort({ dateFrom: -1 });

  const userEducationHistory = await UserEducationHistory.find({
    userId,
  }).limit(5).sort({ dateFrom: -1 });

  const sortedUserJobHistory = userJobHistory.reduce((prev, record) => {
    if (!record.dateTo) {
      prev.unshift(record);
    } else {
      prev.push(record);
    }
    return prev;
  }, []);

  const sortedUserEducationHistory = userEducationHistory.reduce((prev, record) => {
    if (!record.dateTo) {
      prev.unshift(record);
    } else {
      prev.push(record);
    }
    return prev;
  }, []);

  return {
    ...user.toObject(),
    numberOfFriends: user.numberOfFriendsAsRequester + user.numberOfFriendsAsReceiver,
    password: '',
    profileVideoUrl: getCloudfrontSignedUrl(profileVideoKey),
    profileImageHeaders: getFileSignedHeaders(user.profileImageUrl),
    userJobHistory: sortedUserJobHistory,
    userEducationHistory: sortedUserEducationHistory,
  };
};
const updateUserDetails = async ({ userId, details }) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error('User could not be found.');
  }

  if (details && typeof details !== 'object') {
    throw new Error('Invalid Details.');
  }

  Object.keys(details).forEach((key) => {
    // incase the app tries to send empty data for any field as all the fields need to be populated e.g. if they try to make the firstname empty
    if (details[key] === '') { throw new Error(`${key} is required and cannot be an empty string`); }
  });

  if (details.username && details.username.length < 3) {
    throw new Error('Username is too short');
  }

  const schema = object().shape({
    firstName: string(),
    lastName: string(),
    email: string().email(),
    password: string().min(8, 'Password is too short - should be 8 chars minimum.')
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/, 'Password is not secure enough.'),
    username: string(),
    flipProfileVideo: boolean(),
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

  if (details.profileVideoKey) {
    if (!details.profileGifKey) throw new Error('No profile gif provided.');
    const currentProfileGifUrl = user.profileGifUrl;
    const currentProfileVideoUrl = user.profileVideoUrl;
    const currentProfileImageUrl = user.profileImageUrl;

    const gifUrlIndex = currentProfileGifUrl?.lastIndexOf('/');
    const videoUrlIndex = currentProfileVideoUrl?.lastIndexOf('/');

    const currentProfileGifKey = currentProfileGifUrl?.substring(gifUrlIndex + 1);
    const currentProfileVideoKey = currentProfileVideoUrl?.substring(videoUrlIndex + 1);
    const currentProfileImageKey = currentProfileImageUrl?.substring(videoUrlIndex + 1);

    const profileVideoUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/profileVideos/${details.profileVideoKey}`;
    const profileGifUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/profileGifs/${details.profileGifKey}`;
    await User.findByIdAndUpdate(userId, {
      ...details,
      profileVideoUrl,
      profileGifUrl,
      profileImageUrl: '',
    });
    if (profileVideoUrl && profileGifUrl && (currentProfileVideoUrl || currentProfileGifUrl || currentProfileImageUrl)) {
      await Promise.allSettled([
        deleteFile(currentProfileGifKey),
        deleteFile(currentProfileVideoKey),
        deleteFile(currentProfileImageKey),
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

  if (details.profileImageKey) {
    const currentProfileGifUrl = user.profileGifUrl;
    const currentProfileVideoUrl = user.profileVideoUrl;
    const currentProfileImageUrl = user.profileImageUrl;

    const gifUrlIndex = currentProfileGifUrl?.lastIndexOf('/');
    const videoUrlIndex = currentProfileVideoUrl?.lastIndexOf('/');
    const imageUrlIndex = currentProfileImageUrl?.lastIndexOf('/');

    const currentProfileGifKey = currentProfileGifUrl?.substring(gifUrlIndex + 1);
    const currentProfileVideoKey = currentProfileVideoUrl?.substring(videoUrlIndex + 1);
    const currentProfileImageKey = currentProfileImageUrl?.substring(imageUrlIndex + 1);

    const profileImageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_BUCKET_REGION}.amazonaws.com/profileImages/${details.profileImageKey}`;

    await User.findByIdAndUpdate(userId, {
      ...details,
      profileVideoUrl: '',
      profileGifUrl: '',
      profileImageUrl,
    });
    if (profileImageUrl && (currentProfileVideoUrl || currentProfileGifUrl || currentProfileImageUrl)) {
      await Promise.allSettled([
        deleteFile(currentProfileGifKey),
        deleteFile(currentProfileVideoKey),
        deleteFile(currentProfileImageKey),
      ]);
    }
    return {
      ...user.toObject(),
      ...details,
      profileImageUrl,
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

const deleteUser = async (userId) => {
  // mark as terminated;
  const user = await User.findByIdAndUpdate(userId, { terminated: true });
  if (!user) {
    throw new Error('User does not exist.');
  }

  // create offset var
  let totalDeleted = 0;
  if (user.numberOfPosts) {
    while (totalDeleted < user.numberOfPosts) {
    // get 500 user posts
      const posts = await Posts.find({
        userId,
        mediaKey: { $ne: null },
      }, 'mediaKey').skip(totalDeleted).limit(500);
      totalDeleted += posts.length;
      if (!posts.length) {
        break;
      }
      // Create array of all aws keys for all posts
      const mediaKeys = posts.reduce((keys, post) => {
        if (typeof post.mediaKey === 'string' && post.mediaKey.length > 0) {
          keys.push({ Key: post.mediaKey });
        }
        return keys;
      }, []);

      // delete all above files using mediakeys
      await deleteMultipleFiles(mediaKeys);

      await Posts.deleteMany({ userId: user._id });
    }
  }
  user.numberOfPosts -= totalDeleted;

  await User.findByIdAndDelete(userId);

  return { done: true, totalDeleted };
};

const changeAccountVisibility = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist');
  }
  if (!user.private && user.followersMode) {
    throw new Error("Cannot make an account private when it's in followers mode.");
  }
  const oldVisibility = user.private;
  user.private = !oldVisibility;
  user.save();
  const userDataObj = user.toObject();

  delete userDataObj.password;

  return { userData: userDataObj };
};

const toggleFollowersMode = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User does not exist');
  }

  user.private = false;
  user.followersMode = !user.followersMode;
  user.save();
  return { followersMode: user.followersMode };
};

const reportUser = async (reporterId, userToReportId, reason) => {
  const userToReport = await User.findById(userToReportId);
  if (!userToReport) throw new Error('User to report does not exist');

  const reporter = await User.findById(reporterId);
  if (!reporter) throw new Error('User does not exist');

  const existingReport = await UserReports.findOne({ reporterId, userId: userToReportId });
  if (existingReport) {
    return existingReport;
  }

  const report = new UserReports({ reporterId, userId: userToReportId, reason });
  if (userToReport.reportsCount >= (userToReport.numberOfFriendsAsReceiver / 6)) {
    userToReport.underWatch = true;
  }
  userToReport.reportsCount += 1;

  report.save();
  userToReport.save();

  return { report, underWatch: userToReport.underWatch };
};

const blockUser = async (userId, userToBlockId) => {
  if (userId === userToBlockId) throw new Error('Cannot block the same user.');
  const userToBlock = await User.findById(userToBlockId);

  if (!userToBlock) throw new Error('User to block does not exist');

  const alreadyBlocked = await BlockedUsers.findOne({ userId, blockedUserId: userToBlockId });

  if (alreadyBlocked) throw new Error('User is already blocked');

  const newBlockedUser = new BlockedUsers({ userId, blockedUserId: userToBlockId });

  // const isContact = await Connections.findOneAndDelete({
  //   requesterId: userId,
  //   receiverId: userToBlockId,
  // }) || await Connections.findOneAndDelete({
  //   requesterId: userToBlockId,
  //   receiverId: userId,
  // });

  await removeConnection(userId, userToBlockId, true);

  newBlockedUser.save();
  return { blocked: true };
};

const unBlockUser = async (userId, userToUnBlockId) => {
  if (userId === userToUnBlockId) throw new Error('Cannot block the same user.');

  const blockedUser = await BlockedUsers.findOneAndDelete({ userId, blockedUserId: userToUnBlockId });
  if (!blockedUser) throw new Error('User is not blocked');
};

module.exports = {
  loginUser,
  verifyRegisterationDetails,
  registerUser,
  resetUserPassword,
  createUserPasswordReset,
  getUserData,
  updateUserDetails,
  checkUserExists,
  deleteUser,
  changeAccountVisibility,
  toggleFollowersMode,
  reportUser,
  blockUser,
  unBlockUser,
  createEmailVerification,
  verifyUserEmail,
};
