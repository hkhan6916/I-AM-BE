module.exports = (document) => {
  let age = 0;
  const date = new Date(document.createdAt);
  const now = new Date();

  const documentAge = Math.abs(now - date);
  let minutes = Math.floor(documentAge / (1000 * 24));
  if (minutes < 1) {
    minutes = 1;
  }
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 60) {
    age = { minutes };
  } else if (hours < 24) {
    age = { hours };
  } else {
    age = { days };
  }
  document.age = age;
};
