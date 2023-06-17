require('dotenv').config();
const express = require('express');
const axios = require('axios');
const HARVESTER_ABI = require('./HarvesterABI.json');


const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/nfts', async (req, res) => {
    const address = req.query.address;
    const url = `https://polygon-mumbai.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getNFTs?owner=${address}`;
    try {
        const response = await axios.get(url);
        if (response.status !== 200) {
            // The Alchemy API responded with an error
            return res.status(response.status).json({ error: response.data });
        }
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching NFTs.' });
    }
});

app.get('/api/nft', (req, res) => {

    res.json({
        NFT_ABI: process.env.NFT_ABI,
    });
});

app.get('/api/harvester', (req, res) => {

    res.json({
        HARVESTER_ABI: process.env.HARVESTER_ABI,
        HARVESTER_ADDRESS: process.env.HARVESTER_ADDRESS,
    });

});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
