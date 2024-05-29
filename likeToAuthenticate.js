const findLikers = require("./likers.js");
async function likeToAuthenticate(warpcast_username_1, url) {
  warpcast_username_1 = warpcast_username_1.toLowerCase()
  list_of_likers = await findLikers(url);
  const liker = list_of_likers.find((likers) => likers === warpcast_username_1);
  if (liker) {
    return true;
  } else {
    return false;
  }
}


module.exports = likeToAuthenticate