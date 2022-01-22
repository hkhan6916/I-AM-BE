module.exports = (document) => {
  let age = 0;
  const date = new Date(document.createdAt);
  const now = new Date();

  const ms = Math.abs(now - date);

  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const daysms = ms % (24 * 60 * 60 * 1000);
  const hours = Math.floor(daysms / (60 * 60 * 1000));
  const hoursms = ms % (60 * 60 * 1000);
  const minutes = Math.floor(hoursms / (60 * 1000));
  if (days) {
    age = { days };
  } else if (hours) {
    age = { hours };
  } else {
    age = { minutes };
  }
  document.age = age;
};
