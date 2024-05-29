const axios = require("axios");

async function urlValidation(url) {
  // Extract shorthash and username from the provided URL
  const parts = url.split("/");
  const shorthash = parts.pop();
  const username = parts.pop();

  // Construct the first URL to fetch long hash
  const firstUrl = `https://client.warpcast.com/v2/user-cast?username=${username}&hashPrefix=${shorthash}`;
try{

    res = await axios.get(firstUrl)
    return true
}catch{
    return false
}
  
}

module.exports = urlValidation;

