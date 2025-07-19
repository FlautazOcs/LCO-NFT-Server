require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
const Stripe = require("stripe");

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.use(bodyParser.raw({ type: "application/json" }));

const provider = new ethers.JsonRpcProvider("https://polygon-rpc.com");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, [
  "function safeMint(address recipient, string memory metadataURI) public returns (uint256)"
], wallet);

const METADATA_URIS = {
  Bronze: "ipfs://bafkreigkklmr5jyc62osvw3eq6zg2rc4ptocibfryncek3oge4p33xujzq",
  Silver: "ipfs://bafkreie3isvhwhzn2yvg4eiuvzwbmnla3wwww5dd6gl233dx5hk3newbvy",
  Gold:   "ipfs://bafkreib2omhppf7wntque4xaal5wn37hr5mjbx36nxhmdeorsqmic4dayi"
};

app.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log("Webhook signature verification failed.");
    return res.sendStatus(400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const wallet = session.client_reference_id;
    const tier = session.display_items?.[0]?.custom?.name || "Bronze";
    const uri = METADATA_URIS[tier];

    try {
      const tx = await contract.safeMint(wallet, uri);
      await tx.wait();
      console.log(`✅ Minted ${tier} NFT to ${wallet}`);
    } catch (e) {
      console.error("Minting failed:", e);
    }
  }

  res.status(200).send("Webhook received");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
