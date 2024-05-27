const axios = require('axios');

async function bioFinder(username, textToFind) {
    try {
        const response = await axios.get(`https://client.warpcast.com/v2/user-by-username?username=${username.toLowerCase()}`);
        
        // Extract the bio text
      
        const bioText = response.data.result.user.profile.bio.text;

        // Log the bio text to the console
        console.log('Bio Text:', bioText);

        // Check if the bio text contains the given text
        if (bioText.toLowerCase().includes(textToFind.toLowerCase())) {
            console.log(`The bio contains the text: "${textToFind}"`);
            return true;
        } else {
            console.log(`The bio does not contain the text: "${textToFind}"`);
            return false;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        console.error('Error fetching data:', error);
        return false;
    }
}


// Example usage
async function run() {
    const result = await bioFinder("babaksadeghi", "esearcher");
    console.log('Result:', result);
}

module.exports = bioFinder