module.exports = (date) => {
  const ageDifMs = Date.now() - date;
  const ageDate = new Date(ageDifMs);

  const showYear = Math.abs(ageDate.getUTCFullYear() - 1970) >= 1;

  const year = date.getFullYear();
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();

  if (showYear) {
    return `${month} ${day} ${year}`;
  }
  return `${month} ${day}`;
};
