module.exports = (post) => {
  let age = 0;
  const date = new Date(post.createdAt);
  const now = new Date();

  const postAge = Math.abs(now - date);
  const minutes = Math.floor(postAge / (1000 * 24));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 60) {
    age = { minutes };
  } else if (hours < 24) {
    age = { hours };
  } else {
    age = { days };
  }
  post.age = age;
};
