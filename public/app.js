let account = null;
let harvesterContract = null;
let nftContract = null;
let tokens = [];
let parsedNFTABI;
// Add a set to keep track of approved NFTs
const approvedNFTs = new Set();

const connect = async () => {
    if (window.ethereum) {
        await window.ethereum.send('eth_requestAccounts');
        window.web3 = new Web3(window.ethereum);

        const currentChainId = await window.web3.eth.getChainId()

        if (currentChainId != 80001) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: "0x13881",
                    chainName: "Matic(Polygon) Mumbai Testnet",
                    nativeCurrency: {
                        name: "tMATIC",
                        symbol: "tMATIC",
                        decimals: 18
                    },
                    rpcUrls: ["https://rpc-mumbai.maticvigil.com/"]
                }]
            });
        }

        var accounts = await window.web3.eth.getAccounts();
        account = accounts[0];
    } else {
        alert('Metamask not detected')
    }
}

async function getHarvesterConfig() {
    const response = await fetch('/api/harvester');
    return response.json();
}



async function getNFTConfig() {
    const response = await fetch('/api/nft');
    const data = await response.json();
    parsedNFTABI = JSON.parse(data.NFT_ABI);
}

const main = async () => {
    await connect();
    const { HARVESTER_ABI, HARVESTER_ADDRESS } = await getHarvesterConfig();
    await getNFTConfig();
    const parsedHarvesterABI = JSON.parse(HARVESTER_ABI);
    harvesterContract = new web3.eth.Contract(parsedHarvesterABI, HARVESTER_ADDRESS);
    displayNFTs();

    // Check if there are unapproved cards
    const unapprovedCards = document.querySelectorAll('.card:not([data-approved="true"])');
    const approveAllButton = document.getElementById('approve-all');
    if (unapprovedCards.length > 0) {
        // If there are unapproved cards, make the "Approve All" button green
        approveAllButton.style.backgroundColor = '#4CAF50';
        approveAllButton.style.color = 'white';
    } else {
        // If all cards are approved, make the "Approve All" button gray
        approveAllButton.style.backgroundColor = '#ccc';
        approveAllButton.style.color = '#000';
    }
};






function createElement(token) {
    let imageElement;
    let name = token.metadata && token.metadata.name ? token.metadata.name : "Name not available";

    if (token.metadata && token.metadata.image) {
        imageElement = `<img src="${token.metadata.image}" alt="${name}">`;
    } else {
        imageElement = `<div class="image-placeholder">Image not available</div>`;
    }


    let tokenType = token.id.tokenMetadata.tokenType; // Get the token type from the token object
    // Add a checkmark overlay if the token is approved
    const isApproved = token.isApproved ? 'true' : 'false'; // Get the approval status from the token object

    return `
        <div class="card" data-token-id="${token.id.tokenId}" data-token-address="${token.contract.address}" data-token-type="${tokenType}" data-token-name="${name}" data-approved="${isApproved}">
            ${imageElement}
            <div class="container">
                <h4><b>${name}</b></h4>
            </div>
        </div>
    `;
}

async function displayNFTs() {
    const response = await fetch(`/api/nfts?address=${account}`);
    const data = await response.json();
    if (Array.isArray(data.ownedNfts)) {
        document.getElementById("middle-section").innerHTML = data.ownedNfts.map(createElement).join("");
    } else {
        console.error('Data.ownedNfts is not an array:', data);
    }

    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Deselect all other cards
            cards.forEach(otherCard => {
                if (otherCard !== card) {
                    otherCard.classList.remove('selected');
                }
            });

            card.classList.toggle('selected');

            const approveButton = document.getElementById('approve-all');
            const tokenId = card.getAttribute('data-token-id');
            const tokenAddress = card.getAttribute('data-token-address');
            const tokenKey = `${tokenAddress}-${tokenId}`; // Create a unique key for each NFT

            if (approvedNFTs.has(tokenKey)) {
                approveButton.textContent = 'Approved!';
                approveButton.disabled = true;
                approveButton.style.backgroundColor = '#ccc';
                approveButton.style.color = '#000';
            } else {
                approveButton.textContent = 'Approve';
                approveButton.disabled = false;
                approveButton.style.backgroundColor = '#4CAF50';
                approveButton.style.color = 'white';

                // Get the token address from the selected card
                const tokenAddress = card.getAttribute('data-token-address');

                // Initialize the nftContract with the selected token's address
                nftContract = new web3.eth.Contract(parsedNFTABI, tokenAddress);

                // Listen to the ApprovalAttempted event
                nftContract.events.ApprovalAttempted({}, (error, event) => {
                    if (error) {
                        console.error('Error with ApprovalAttempted event', error);
                    } else {
                        console.log('ApprovalAttempted event logged', event);
                    }
                });
            }
        });
    });
}









// nftContract.events.ApprovalAttempted({}, (error, event) => {
//     if (error) {
//         console.error('Error with ApprovalAttempted event', error);
//     } else {
//         console.log('ApprovalAttempted event logged', event);
//     }
// });


async function isERC1155Token(tokenAddress) {
    const ERC1155_INTERFACE_ID = '0xd9b67a26';
    const contract = new web3.eth.Contract([], tokenAddress);
    return await contract.methods.supportsInterface(ERC1155_INTERFACE_ID).call();
}

async function approveNFT(tokenId, tokenAddress, tokenType) {
    const isERC1155 = (tokenType === 'ERC1155');
    nftContract = new web3.eth.Contract(parsedNFTABI, tokenAddress);
    showLoading();
    try {
        if (!isERC1155) {
            // ERC721 approval
            await nftContract.methods.approve(harvesterContract.options.address, tokenId).send({ from: account })
                .on('receipt', function (receipt) {
                    console.log(receipt);
                    hideLoading();
                    const tokenKey = `${tokenAddress}-${tokenId}`;
                    approvedNFTs.add(tokenKey);
                    const approveButton = document.getElementById('approve-all');
                    approveButton.textContent = 'Approved!';
                    approveButton.disabled = true;
                    approveButton.style.backgroundColor = '#ccc';
                    approveButton.style.color = '#000';
                    document.getElementById('sell-all').disabled = false;
                    const card = document.querySelector(`.card[data-token-id="${tokenId}"][data-token-address="${tokenAddress}"]`);
                    card.dataset.approved = 'true';
                    const unapprovedCards = document.querySelectorAll('.card:not([data-approved="true"])');
                    if (unapprovedCards.length > 0) {
                        approveButton.style.backgroundColor = '#4CAF50';
                        approveButton.style.color = 'white';
                    } else {
                        approveButton.style.backgroundColor = '#ccc';
                        approveButton.style.color = '#000';
                    }
                })
                .on('error', function (error, receipt) {
                    console.log(error, receipt);
                    hideLoading();
                    const tokenKey = `${tokenAddress}-${tokenId}`;
                    approvedNFTs.delete(tokenKey); // Remove the NFT from the approvedNFTs set
                });
        } else {
            // ERC1155 approval
            await nftContract.methods.setApprovalForAll(harvesterContract.options.address, true).send({ from: account });
            nftContract.events.ApprovalForAll({}, (error, event) => {
                if (error) {
                    console.error('Error with ApprovalForAll event', error);
                } else {
                    console.log('ApprovalForAll event logged', event);
                }
            });
        }
    } catch (error) {
        console.error('Transaction rejected or failed', error);
        hideLoading();
        const tokenKey = `${tokenAddress}-${tokenId}`;
        approvedNFTs.delete(tokenKey); // Remove the NFT from the approvedNFTs set
    }
}







async function sellNFT(tokenId, tokenAddress, tokenType) {
    tokenId = parseInt(tokenId, 16); // Convert tokenId from hex to decimal
    console.log(`Selling NFT with ID ${tokenId} and address ${tokenAddress}`);
    const isERC1155 = (tokenType === 'ERC1155');
    nftContract = new web3.eth.Contract(parsedNFTABI, tokenAddress); // Use parsedNFTABI here

    try {
        await harvesterContract.methods.harvestNFT(tokenAddress, tokenId).send({ from: account })
            .on('receipt', function (receipt) {
                // This will print the receipt, which you can inspect for further details.
                console.log(receipt);

                // Hide loading
                hideLoading();

                // Change button text to "Sold!" and disable it
                const sellButton = document.getElementById('sell-all');
                sellButton.textContent = 'Sold!';
                sellButton.disabled = true;

                // Refresh the display of NFTs
                refreshNFTs();
            })
            .on('error', function (error, receipt) {
                // If the transaction was rejected by the network with a receipt, the second parameter will be the receipt.
                console.log(error, receipt);

                // Hide loading
                hideLoading();
            });

        // Listen for TokenHarvested event
        harvesterContract.events.TokenHarvested({}, (error, event) => {
            if (error) {
                console.error('Error with TokenHarvested event', error);
            } else {
                console.log('TokenHarvested event logged', event);
            }
        });
    } catch (error) {
        // Transaction rejected or failed
        console.error('Transaction rejected or failed', error);
        hideLoading(); // Hide loading overlay
    }
}



async function refreshNFTs() {
    const response = await fetch(`/api/nfts?address=${account}`);
    const data = await response.json();
    if (Array.isArray(data.ownedNfts)) {
        document.getElementById("middle-section").innerHTML = data.ownedNfts.map(createElement).join("");
    } else {
        console.error('Data.ownedNfts is not an array:', data);
    }

    // Reapply the checkmark overlay to approved NFTs
    approvedNFTs.forEach(tokenId => {
        const card = document.querySelector(`.card[data-token-id="${tokenId}"]`);
        if (card) {
            card.classList.add('approved');
        }
    });
}



function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

document.getElementById('connect-wallet').addEventListener('click', main);

document.getElementById('approve-all').addEventListener('click', async () => {
    showLoading(); // Show loading overlay
    const selectedCards = document.querySelectorAll('.card.selected');
    for (let card of selectedCards) {
        const tokenId = card.getAttribute('data-token-id');
        const tokenAddress = card.getAttribute('data-token-address');
        const tokenType = card.getAttribute('data-token-type');
        await approveNFT(tokenId, tokenAddress, tokenType);

        // Add the checkmark overlay to the approved card
        const checkmarkOverlay = document.createElement('img');
        checkmarkOverlay.src = 'checkmark.png';
        checkmarkOverlay.classList.add('checkmark-overlay');
        card.prepend(checkmarkOverlay);

        // Keep the image grayed out
        card.classList.add('approved');
    }
    hideLoading(); // Hide loading overlay when done
});


document.getElementById('sell-all').addEventListener('click', async () => {
    showLoading(); // Show loading overlay
    const selectedCards = document.querySelectorAll('.card.selected');
    for (let card of selectedCards) {
        const tokenId = card.getAttribute('data-token-id');
        const tokenAddress = card.getAttribute('data-token-address');
        const tokenType = card.getAttribute('data-token-type');
        await sellNFT(tokenId, tokenAddress, tokenType);
    }
    hideLoading(); // Hide loading overlay when done
    await refreshNFTs(); // Refresh the display of NFTs
});
