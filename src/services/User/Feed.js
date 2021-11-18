const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const PostLikes = require('../../models/user/PostLikes');
const User = require('../../models/user/User');
const getPostAge = require('../../helpers/getPostAge');

const getUserFeed = async ({ userId, feedTimelineOffset, friendsInterestsOffset }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User could not be found.');
  }

  /**
   * Gets the feed based on what a user's friends have posted.
   *
   * 1. Gets all posts using userId by looping through connections/friends list.
   * 2. Gets any post using the repostPostId in case the post is a repost.
   * 3. Also gets the user as for the repost.
   * 4. Also gets the user for the current parent post.
   * 5. Goes through the current user's PostLikes record and checks if they've liked this parent
   *    post. returns true or false for the liked field
   */
  const friendsPostsBasedFeed = await Posts.aggregate([
    {
      $match: {
        userId: { $in: user.connections.map((id) => ObjectId(id)) },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: feedTimelineOffset || 0 },
    { $limit: 5 },
    {
      $lookup: {
        from: 'posts',
        let: { id: '$repostPostId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$_id', { $toObjectId: '$$id' }],
              },
            },
          },
          {
            $lookup: {
              from: 'users',
              let: { id: '$userId' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ['$_id', '$$id'],
                    },
                  },
                },
                {
                  $project: {
                    _id: 1,
                    username: 1,
                    profileGifUrl: 1,
                    firstName: 1,
                    lastName: 1,
                  },
                },
              ],
              as: 'postAuthor',
            },
          },
          {
            $unwind: '$postAuthor',
          },
        ],
        as: 'repostPostObj',
      },
    }, {
      $lookup: {
        from: 'users',
        let: { id: '$userId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$id'] } } },
          {
            $project: {
              profileGifUrl: 1, username: 1, firstName: 1, lastName: 1,
            },
          },
        ],
        as: 'postAuthor',
      },
    },
    {
      $lookup: {
        from: 'postlikes',
        let: { likedBy: ObjectId(userId), postId: '$_id' },
        pipeline: [
          { $match: { $expr: { $and: [{ $eq: ['$likedBy', '$$likedBy'] }, { $eq: ['$postId', { $toObjectId: '$$postId' }] }] } } },
          {
            $project: {
              _id: 1,
              likedBy: 1,
            },
          },
        ],
        as: 'liked',
      },
    },
    { $unwind: '$postAuthor' },
    {
      $unwind:
       {
         path: '$liked',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $unwind:
       {
         path: '$repostPostObj',
         preserveNullAndEmptyArrays: true,
       },
    },
    {
      $project: {
        _id: 1,
        body: 1,
        mediaUrl: 1,
        mediaMimeType: 1,
        mediaType: 1,
        mediaOrientation: 1,
        mediaIsSelfie: 1,
        repostPostId: 1,
        repostPostObj: 1,
        repostPostObjUser: 1,
        userId: 1,
        likes: 1,
        private: 1,
        postAuthor: 1,
        createdAt: 1,
        liked: {
          $cond: {
            if: { $ne: [{ $type: '$liked' }, 'missing'] },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  const ids = [];
  friendsPostsBasedFeed.forEach((i) => {
    ids.push(i._id.toString());
  });

  /**
   * Gets the feed based on what a user's friends have liked.
   *
   * 1. Goes through the PostLikes records for all the friends of a user
   * 2. Using the friend's PostLikes records, it gets all posts the friends have liked
   * 3. Gets any child posts incase the posts are reposts of existing posts.
   * 4. Gets the postAuthor for the child posts.
   * 5. Gets data about the friend who liked the parent post.
   * 6. Checks if the user has liked the post already.
   * 7. Gets the postAuthor for this parent post
   *
   */
  const friendsInterestsBasedFeed = [];
  // await PostLikes.aggregate([
  //   {
  //     $match: {
  //       likedBy: { $in: user.connections.map((id) => id) },
  //     },
  //   },
  //   { $sort: { createdAt: -1 } },
  //   {
  //     $lookup: {
  //       from: 'posts',
  //       let: { likedBy: '$likedBy', postsArray: '$posts' },
  //       pipeline: [
  //         {
  //           $match: {
  //             $expr: {
  //               $cond: {
  //                 if: { $in: [{ $toString: '$_id' }, ids] },
  //                 then: null,
  //                 else: { $in: [{ $toString: '$_id' }, '$$postsArray'] },
  //               },
  //             },
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: 'posts',
  //             let: { id: '$repostPostId' },
  //             pipeline: [
  //               {
  //                 $match: {
  //                   $expr: {
  //                     $eq: ['$_id', { $toObjectId: '$$id' }],
  //                   },
  //                 },
  //               },
  //               {
  //                 $lookup: {
  //                   from: 'users',
  //                   let: { id: '$userId' },
  //                   pipeline: [
  //                     {
  //                       $match: {
  //                         $expr: {
  //                           $eq: ['$_id', '$$id'],
  //                         },
  //                       },
  //                     },
  //                     {
  //                       $project: {
  //                         _id: 1,
  //                         username: 1,
  //                         profileGifUrl: 1,
  //                         firstName: 1,
  //                         lastName: 1,
  //                       },
  //                     },
  //                   ],
  //                   as: 'postAuthor',
  //                 },
  //               },
  //               {
  //                 $unwind: '$postAuthor',
  //               },
  //             ],
  //             as: 'repostPostObj',
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: 'users',
  //             let: { friendToFind: '$$likedBy' },
  //             pipeline: [
  //               {
  //                 $match: {
  //                   $expr: {
  //                     $cond: {
  //                       if: { $not: { $in: [{ $toString: '$_id' }, ids] } },
  //                       then: { $eq: ['$_id', { $toObjectId: '$$friendToFind' }] },
  //                       else: {},
  //                     },
  //                   },
  //                 },
  //               },
  //               {
  //                 $project: {
  //                   username: 1,
  //                   firstName: 1,
  //                   lastName: 1,
  //                   profileGifUrl: 1,
  //                 },
  //               },
  //             ],
  //             as: 'likedBy',
  //           },
  //         },
  //         {
  //           $lookup: {
  //             from: 'postlikes',
  //             let: { id: ObjectId(userId) },
  //             pipeline: [
  //               { $match: { $expr: { $eq: ['$likedBy', '$$id'] } } },
  //               {
  //                 $project: {
  //                   _id: 1,
  //                   posts: 1,
  //                 },
  //               },
  //             ],
  //             as: 'liked',
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
  //           $unwind:
  //            {
  //              path: '$postAuthor',
  //              preserveNullAndEmptyArrays: true,
  //            },
  //         },
  //         {
  //           $unwind:
  //            {
  //              path: '$likedBy',
  //              preserveNullAndEmptyArrays: true,
  //            },
  //         },
  //         {
  //           $unwind:
  //            {
  //              path: '$repostPostObj',
  //              preserveNullAndEmptyArrays: true,
  //            },
  //         },
  //         { $skip: friendsInterestsOffset || 0 },
  //         { $limit: 5 },
  //       ],
  //       as: 'friendsInterestsBasedPost',
  //     },
  //   },
  //   {
  //     $unwind:
  //      {
  //        path: '$friendsInterestsBasedPost',
  //        preserveNullAndEmptyArrays: true,
  //      },
  //   },
  //   {
  //     $replaceRoot: {
  //       newRoot: {
  //         $cond: {
  //           if: { $ne: [{ $type: '$friendsInterestsBasedPost' }, 'missing'] },
  //           then: '$friendsInterestsBasedPost',
  //           else: {},
  //         },
  //       },
  //     },
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
  //       likedBy: 1,
  //       liked: {
  //         $cond: {
  //           if: { $ne: [{ $type: '$liked' }, 'missing'] },
  //           then: {
  //             $cond: {
  //               if: { $in: [{ $toString: '$_id' }, '$liked.posts'] },
  //               then: true,
  //               else: false,
  //             },
  //           },
  //           else: null,
  //         },
  //       },
  //     },
  //   },
  //   {
  //     $redact: {
  //       $cond: {
  //         if: { $eq: ['$liked', null] },
  //         then: '$$PRUNE',
  //         else: '$$DESCEND',
  //       },
  //     },
  //   },
  // ]);

  const removeDuplicatePosts = (posts) => Array.from(new Set(posts.map((a) => a._id)))
    .map((id) => posts.find((a) => a._id === id));

  const sortByDate = (posts) => posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const feed = sortByDate(removeDuplicatePosts(
    [...friendsPostsBasedFeed, ...friendsInterestsBasedFeed],
  ));

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
