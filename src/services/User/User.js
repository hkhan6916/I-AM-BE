const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { object, string } = require('yup');
const sgMail = require('@sendgrid/mail');
const User = require('../../models/user/User');
const { sendFriendRequest } = require('./Friends');
const {
  uploadProfileVideo, deleteFile, tmpCleanup, getFileSignedHeaders, deleteMultipleFiles,
} = require('../../helpers');
const Posts = require('../../models/posts/Posts');
const getCloudfrontSignedUrl = require('../../helpers/getCloudfrontSignedUrl');

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

    return { token, userId: user._id, apiKeys: { tenorApiKey: process.env.TENOR_API_KEY } };
  }

  throw new Error('Invalid email/password');
};

const registerUser = async ({
  username, email, plainTextPassword, firstName, lastName, file, notificationToken,
}) => {
  if (!file) {
    throw new Error('No video profile provided');
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
  });

  await schema.validate({
    username, firstName, lastName, email, password: plainTextPassword, notificationToken,
  }).catch((err) => {
    if (err.errors?.length) {
      throw new Error(err.errors[0]);
    }
  });

  if (username && username.length < 3) {
    throw new Error('Username is too short');
  }

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
    const msg = {
      to: email,
      from: 'noreply@magnetapp.co.uk',
      subject: 'Password Reset Request',
      html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
      <html data-editor-version="2" class="sg-campaigns" xmlns="http://www.w3.org/1999/xhtml">
          <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">
            <!--[if !mso]><!-->
            <meta http-equiv="X-UA-Compatible" content="IE=Edge">
            <!--<![endif]-->
            <!--[if (gte mso 9)|(IE)]>
            <xml>
              <o:OfficeDocumentSettings>
                <o:AllowPNG/>
                <o:PixelsPerInch>96</o:PixelsPerInch>
              </o:OfficeDocumentSettings>
            </xml>
            <![endif]-->
            <!--[if (gte mso 9)|(IE)]>
        <style type="text/css">
          body {width: 600px;margin: 0 auto;}
          table {border-collapse: collapse;}
          table, td {mso-table-lspace: 0pt;mso-table-rspace: 0pt;}
          img {-ms-interpolation-mode: bicubic;}
        </style>
      <![endif]-->
            <style type="text/css">
          body, p, div {
            font-family: inherit;
            font-size: 14px;
          }
          body {
            color: #000000;
          }
          body a {
            color: #1188E6;
            text-decoration: none;
          }
          p { margin: 0; padding: 0; }
          table.wrapper {
            width:100% !important;
            table-layout: fixed;
            -webkit-font-smoothing: antialiased;
            -webkit-text-size-adjust: 100%;
            -moz-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
          }
          img.max-width {
            max-width: 100% !important;
          }
          .column.of-2 {
            width: 50%;
          }
          .column.of-3 {
            width: 33.333%;
          }
          .column.of-4 {
            width: 25%;
          }
          ul ul ul ul  {
            list-style-type: disc !important;
          }
          ol ol {
            list-style-type: lower-roman !important;
          }
          ol ol ol {
            list-style-type: lower-latin !important;
          }
          ol ol ol ol {
            list-style-type: decimal !important;
          }
          @media screen and (max-width:480px) {
            .preheader .rightColumnContent,
            .footer .rightColumnContent {
              text-align: left !important;
            }
            .preheader .rightColumnContent div,
            .preheader .rightColumnContent span,
            .footer .rightColumnContent div,
            .footer .rightColumnContent span {
              text-align: left !important;
            }
            .preheader .rightColumnContent,
            .preheader .leftColumnContent {
              font-size: 80% !important;
              padding: 5px 0;
            }
            table.wrapper-mobile {
              width: 100% !important;
              table-layout: fixed;
            }
            img.max-width {
              height: auto !important;
              max-width: 100% !important;
            }
            a.bulletproof-button {
              display: block !important;
              width: auto !important;
              font-size: 80%;
              padding-left: 0 !important;
              padding-right: 0 !important;
            }
            .columns {
              width: 100% !important;
            }
            .column {
              display: block !important;
              width: 100% !important;
              padding-left: 0 !important;
              padding-right: 0 !important;
              margin-left: 0 !important;
              margin-right: 0 !important;
            }
            .social-icon-column {
              display: inline-block !important;
            }
          }
        </style>
            <!--user entered Head Start--><link href="https://fonts.googleapis.com/css?family=Chivo&display=swap" rel="stylesheet"><style>
      body {font-family: 'Chivo', sans-serif;}
      </style><!--End Head user entered-->
          </head>
          <body>
            <center class="wrapper" data-link-color="#1188E6" data-body-style="font-size:14px; font-family:inherit; color:#000000; background-color:#FFFFFF;">
              <div class="webkit">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" class="wrapper" bgcolor="#FFFFFF">
                  <tr>
                    <td valign="top" bgcolor="#FFFFFF" width="100%">
                      <table width="100%" role="content-container" class="outer" align="center" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="100%">
                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td>
                                  <!--[if mso]>
          <center>
          <table><tr><td width="600">
        <![endif]-->
                                          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px;" align="center">
                                            <tr>
                                              <td role="modules-container" style="padding:0px 0px 0px 0px; color:#000000; text-align:left;" bgcolor="#FFFFFF" width="100%" align="left"><table class="module preheader preheader-hide" role="module" data-type="preheader" border="0" cellpadding="0" cellspacing="0" width="100%" style="display: none !important; mso-hide: all; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0;">
          <tr>
            <td role="module-content">
              <p></p>
            </td>
          </tr>
        </table><table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" role="module" data-type="columns" style="padding:50px 0px 0px 30px;" bgcolor="" data-distribution="1">
          <tbody>
            <tr role="module-content">
              <td height="100%" valign="top"><table width="550" style="width:550px; border-spacing:0; border-collapse:collapse; margin:0px 10px 0px 10px;" cellpadding="0" cellspacing="0" align="left" border="0" bgcolor="" class="column column-0">
            <tbody>
              <tr>
                <td style="padding:0px;margin:0px;border-spacing:0;"><table class="wrapper" role="module" data-type="image" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="550f2fb7-70c1-463b-9758-84b6d731ca56">
          <tbody>
            <tr>
              <td style="font-size:6px; line-height:10px; padding:0px 0px 0px 0px;" valign="top" align="center">
                <img class="max-width" border="0" style="display:block; color:#000000; text-decoration:none; font-family:Helvetica, arial, sans-serif; font-size:16px;" width="100" alt="" data-proportionally-constrained="true" data-responsive="false" src="http://cdn.mcauto-images-production.sendgrid.net/663bd9f387761354/63588d9f-969b-4fe9-876b-28c13d0561c5/155x35.png" height="35">
              </td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="spacer" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="d8a6da06-629b-4b1f-a750-84744e679927">
          <tbody>
            <tr>
              <td style="padding:0px 0px 20px 0px;" role="module-content" bgcolor="">
              </td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="b16a4afb-f245-4156-968e-8080176990ea" data-mc-module-version="2019-10-22">
          <tbody>
            <tr>
              <td style="padding:18px 40px 0px 0px; line-height:22px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: center"><span style="color: #00634a; font-size: 24px">We received a request to reset your password.</span></div><div></div></div></td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="b16a4afb-f245-4156-968e-8080176990ea.1" data-mc-module-version="2019-10-22">
          <tbody>
            <tr>
              <td style="padding:18px 40px 10px 0px; line-height:18px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: center">Please click the button below to change your password.</div><div></div></div></td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="spacer" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="c97177b8-c172-4c4b-b5bd-7604cde23e3f">
          <tbody>
            <tr>
              <td style="padding:0px 0px 10px 0px;" role="module-content" bgcolor="">
              </td>
            </tr>
          </tbody>
        </table><table border="0" cellpadding="0" cellspacing="0" class="module" data-role="module-button" data-type="button" role="module" style="table-layout:fixed;" width="100%" data-muid="9c7ac938-a540-4353-9fec-543b193bf7da">
            <tbody>
              <tr>
                <td align="center" bgcolor="" class="outer-td" style="padding:0px 0px 0px 0px;">
                  <table border="0" cellpadding="0" cellspacing="0" class="wrapper-mobile" style="text-align:center;">
                    <tbody>
                      <tr>
                      <td align="center" bgcolor="#138294" class="inner-td" style="border-radius:6px; font-size:16px; text-align:center; background-color:inherit;">
                        <a href="${process.env.MAGNET_WEBSITE_ACCOUNTS_URL}/#/password-reset?token=${resetToken}" style="background-color:#138294; border:1px solid #138294; border-color:#138294; border-radius:0px; border-width:1px; color:#ffffff; display:inline-block; font-size:14px; font-weight:normal; letter-spacing:0px; line-height:normal; padding:12px 50px 12px 50px; text-align:center; text-decoration:none; border-style:solid; font-family:inherit;" target="_blank">Reset Password</a>
                      </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table><table class="module" role="module" data-type="spacer" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="c97177b8-c172-4c4b-b5bd-7604cde23e3f.1">
          <tbody>
            <tr>
              <td style="padding:0px 0px 60px 0px;" role="module-content" bgcolor="">
              </td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="text" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="b16a4afb-f245-4156-968e-8080176990ea.1.1" data-mc-module-version="2019-10-22">
          <tbody>
            <tr>
              <td style="padding:18px 40px 10px 0px; line-height:18px; text-align:inherit;" height="100%" valign="top" bgcolor="" role="module-content"><div><div style="font-family: inherit; text-align: inherit"><span style="color: #00634a">If you did not request a password change, please ignore this email as it was most likely a mistake.</span></div><div></div></div></td>
            </tr>
          </tbody>
        </table></td>
              </tr>
            </tbody>
          </table></td>
            </tr>
          </tbody>
        </table><table class="module" role="module" data-type="divider" border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;" data-muid="38ec2680-c847-4765-8c5f-aa2aba19a2b3">
          <tbody>
            <tr>
              <td style="padding:0px 0px 0px 0px;" role="module-content" height="100%" valign="top" bgcolor="">
                <table border="0" cellpadding="0" cellspacing="0" align="center" width="100%" height="7px" style="line-height:7px; font-size:7px;">
                  <tbody>
                    <tr>
                      <td style="padding:0px 0px 7px 0px;" bgcolor="#ffffff"></td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table></td>
                                            </tr>
                                          </table>
                                          <!--[if mso]>
                                        </td>
                                      </tr>
                                    </table>
                                  </center>
                                  <![endif]-->
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </div>
            </center>
          </body>
        </html>`,
    };
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
  return {
    ...user.toObject(),
    numberOfFriends: user.numberOfFriendsAsRequester + user.numberOfFriendsAsReceiver,
    password: '',
    profileVideoUrl: getCloudfrontSignedUrl(profileVideoKey),
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

  Object.keys(details).forEach((key) => {
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
  const schema = object().shape({
    firstName: string().required(),
    lastName: string().required(),
    email: string().email().required(),
    password: string().required(),
    username: string().required(),
    notificationToken: string().required(),
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

module.exports = {
  loginUser,
  registerUser,
  resetUserPassword,
  createUserPasswordReset,
  getUserData,
  updateUserDetails,
  checkUserExists,
  generateData,
  deleteUser,
  changeAccountVisibility,
  toggleFollowersMode,
};
