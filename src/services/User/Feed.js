const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const UserLikes = require('../../models/user/Likes');
const User = require('../../models/user/User');
const getPostAge = require('../../helpers/getPostAge');

const getUserFeed = async (userId, offset) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User could not be found.');
  }

  const offsetInt = parseInt(offset, 10);
  // const feed = await Posts.aggregate([
  //   {
  //     $match: {
  //       userId: { $in: user.connections.map((id) => ObjectId(id)) },
  //     },
  //   },
  //   { $sort: { createdAt: -1 } },
  //   { $limit: 10 },
  //   { $skip: offsetInt },
  //   {
  //     $lookup: {
  //       from: 'posts',
  //       let: { id: '$repostPostId' },
  //       pipeline: [
  //         {
  //           $match: {
  //             $expr: {
  //               $eq: ['$_id', { $toObjectId: '$$id' }],
  //             },
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: 'users',
  //             let: { id: '$userId' },
  //             pipeline: [
  //               {
  //                 $match: {
  //                   $expr: {
  //                     $eq: ['$_id', '$$id'],
  //                   },
  //                 },
  //               },
  //               {
  //                 $project: {
  //                   _id: 1,
  //                   username: 1,
  //                   profileGifUrl: 1,
  //                   firstName: 1,
  //                   lastName: 1,
  //                 },
  //               },
  //             ],
  //             as: 'postAuthor',
  //           },
  //         },
  //         {
  //           $unwind: '$postAuthor',
  //         },
  //       ],
  //       as: 'repostPostObj',
  //     },
  //   }, {
  //     $lookup: {
  //       from: 'users',
  //       let: { id: '$userId' },
  //       pipeline: [
  //         { $match: { $expr: { $eq: ['$_id', '$$id'] } } },
  //         {
  //           $project: {
  //             profileGifUrl: 1, username: 1, firstName: 1, lastName: 1,
  //           },
  //         },
  //       ],
  //       as: 'postAuthor',
  //     },
  //   },
  //   {
  //     $lookup: {
  //       from: 'userlikes',
  //       let: { id: $userId }, // changed this and added $toUserId
  //       pipeline: [
  //         { $match: { $expr: { $eq: ['$likedBy', '$$id'] } } },
  //         {
  //           $project: {
  //             _id: 1,
  //             posts: 1,
  //           },
  //         },
  //       ],
  //       as: 'liked',
  //     },
  //   },
  //   { $unwind: '$postAuthor' },
  //   { $unwind: '$liked' },
  //   {
  //     $unwind:
  //      {
  //        path: '$repostPostObj',
  //        preserveNullAndEmptyArrays: true,
  //      },
  //   },
  //   {
  //     $project: {
  //       _id: 1,
  //       body: 1,
  //       mediaUrl: 1,
  //       mediaMimeType: 1,
  //       mediaType: 1,
  //       mediaOrientation: 1,
  //       mediaIsSelfie: 1,
  //       repostPostId: 1,
  //       repostPostObj: 1,
  //       repostPostObjUser: 1,
  //       userId: 1,
  //       likes: 1,
  //       private: 1,
  //       postAuthor: 1,
  //       createdAt: 1,
  //       liked: {
  //         $cond: {
  //           if: { $in: [{ $toString: '$_id' }, '$liked.posts'] },
  //           then: true,
  //           else: false,
  //         },
  //       },
  //     },
  //   },
  // ]);

  const feed = await UserLikes.aggregate([
    {
      $match: {
        likedBy: { $in: user.connections.map((id) => id) },
      },
    },
    {
      $lookup: {
        from: 'posts',
        let: { postsArray: '$posts' },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: [{ $toString: '$_id' }, '$$postsArray'],
              },
            },
          },
        ],
        as: 'friendLikedPostsone',
      },
    },
    // {
    //   $unwind: '$postAuthor',
    // },

    // {
    //   $project: {
    //     _id: 1,
    //     // friendLikedPostsone: 1,
    //   },
    // },
  ]);

  if (feed.length) {
    feed.forEach((post) => {
      getPostAge(post);
    });
  }

  return feed;
};

module.exports = {
  getUserFeed,
};
