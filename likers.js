const axios = require('axios');

async function extractLongHash(url) {
    try {
        const response = await axios.get(url);
        const longHash = response.data.result.cast.hash;
        return longHash;
    } catch (error) {
        console.error('Error extracting long hash:', error.message);
        return null;
    }
}

async function extractLikedUsers(url) {
    try {
        const response = await axios.get(url);
        const likes = response.data.result.likes;
        const likedUsernames = likes.map(like => like.reactor.username);
       
        return likedUsernames;
    } catch (error) {
        console.error('Error extracting liked users:', error.message);
        return [];
    }
}

async function findLikers(url) {
    try {
        // Extract shorthash and username from the provided URL
        const parts = url.split('/');
        const shorthash = parts.pop();
        const username = parts.pop();

   

        // Construct the first URL to fetch long hash
        const firstUrl = `https://client.warpcast.com/v2/user-cast?username=${username}&hashPrefix=${shorthash}`;
       

        // Extract long hash
        const longHash = await extractLongHash(firstUrl);
        if (!longHash) {
            console.error('Long hash not found.');
            return;
        }

        // Construct the second URL to fetch liked users
        const secondUrl = `https://client.warpcast.com/v2/cast-likes?castHash=${longHash}`;
        console.log(secondUrl)
        // Extract and display liked users
        const likedUsers = await extractLikedUsers(secondUrl);
        return likedUsers
    } catch (error) {
        console.error('An error occurred:', error.message);
    }
}


module.exports = findLikers;  