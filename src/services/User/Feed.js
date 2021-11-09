const { ObjectId } = require('mongoose').Types;
const Posts = require('../../models/posts/Posts');
const UserLikes = require('../../models/user/Likes');
const User = require('../../models/user/User');
const getPostAge = require('../../helpers/getPostAge');

const getUserFeed = async ({ userId, feedTimelineOffset, friendsInterestsOffset }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User could not be found.');
  }

  const friendsPostsBasedFeed = await Posts.aggregate([
    {
      $match: {
        userId: { $in: user.connections.map((id) => ObjectId(id)) },
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: feedTimelineOffset || 0 },
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
        from: 'userlikes',
        let: { id: userId },
        pipeline: [
          { $match: { $expr: { $eq: ['$likedBy', '$$id'] } } },
          {
            $project: {
              _id: 1,
              posts: 1,
            },
          },
        ],
        as: 'liked',
      },
    },
    { $unwind: '$postAuthor' },
    { $unwind: '$liked' },
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
            if: { $in: [{ $toString: '$_id' }, '$liked.posts'] },
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

  const friendsInterestsBasedFeed = await UserLikes.aggregate([
    {
      $match: {
        likedBy: { $in: user.connections.map((id) => id) },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: 'posts',
        let: { likedBy: '$likedBy', postsArray: '$posts' },
        pipeline: [
          {
            $match: {
              $expr: {
                $cond: {
                  if: { $in: [{ $toString: '$_id' }, ids] },
                  then: null,
                  else: { $in: [{ $toString: '$_id' }, '$$postsArray'] },
                },
                // $in: [{ $toString: '$_id' }, '$$postsArray'],
              },
            },
          },
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
          },
          {
            $lookup: {
              from: 'users',
              let: { friendToFind: '$$likedBy' },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $cond: {
                        if: { $not: { $in: [{ $toString: '$_id' }, ids] } },
                        then: { $eq: ['$_id', { $toObjectId: '$$friendToFind' }] },
                        else: {},
                      },
                    },
                  },
                },
                {
                  $project: {
                    username: 1,
                    firstName: 1,
                    lastName: 1,
                    profileGifUrl: 1,
                  },
                },
              ],
              as: 'likedBy',
            },
          },
          {
            $lookup: {
              from: 'userlikes',
              let: { id: userId },
              pipeline: [
                { $match: { $expr: { $eq: ['$likedBy', '$$id'] } } },
                {
                  $project: {
                    _id: 1,
                    posts: 1,
                  },
                },
              ],
              as: 'liked',
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
            $unwind:
             {
               path: '$postAuthor',
               preserveNullAndEmptyArrays: true,
             },
          },
          {
            $unwind:
             {
               path: '$likedBy',
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
          { $skip: friendsInterestsOffset || 0 },
        ],
        as: 'friendsInterestsBasedPost',
      },
    },
    {
      $unwind:
       {
         path: '$friendsInterestsBasedPost',
         preserveNullAndEmptyArrays: true,
       },
    },
    { $replaceRoot: { newRoot: '$friendsInterestsBasedPost' } },
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
        likedBy: 1,
        liked: {
          $cond: {
            if: { $in: [{ $toString: '$_id' }, '$liked.posts'] },
            then: true,
            else: false,
          },
        },
      },
    },
  ]);

  const removeDuplicatePosts = (posts) => Array.from(new Set(posts.map((a) => a._id)))
    .map((id) => posts.find((a) => a._id === id));

  // const feed = removeDuplicatePosts([...friendsPostsBasedFeed, ...friendsInterestsBasedFeed]);
  const feed = [...friendsPostsBasedFeed, ...friendsInterestsBasedFeed];
  console.log(friendsPostsBasedFeed.length, friendsInterestsBasedFeed.length);
  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  };

  if (feed.length) {
    feed.forEach((post) => {
      getPostAge(post);
    });
  }
  return shuffle(feed);
};

module.exports = {
  getUserFeed,
};
