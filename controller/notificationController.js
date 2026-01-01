// backend/controller/notificationController.js
const SibApiV3Sdk = require("sib-api-v3-sdk");
const client = require("../utils/brevo");


const sendEmail = async (toEmail, templateId, params) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi(client);

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      to: [{ email: toEmail }],
      templateId,
      params,
      sender: { name: "Ton Site", email: "noreply@tonsite.com" },
    });

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Email envoyé à ${toEmail} (template ${templateId})`);
  } catch (err) {
    console.error("Erreur envoi email Brevo:", err);
  }
};

// 1️⃣ Création de compte
const sendWelcomeEmail = async (email, username) => {
  await sendEmail(email, 1, { username });
};

// 2️⃣ Nouvelle commande
const sendNewOrderEmail = async (email, commandeId, total) => {
  await sendEmail(email, 2, { commandeId, total });
};

// 3️⃣ Paiement soumis par le client
const sendPaymentSubmittedEmail = async (email, step, montant, commandeId) => {
  await sendEmail(email, 3, { step, montant, commandeId });
};

// 4️⃣ Paiement confirmé par admin
const sendPaymentConfirmedEmail = async (email, step, montant, commandeId) => {
  await sendEmail(email, 4, { step, montant, commandeId });
};

// 5️⃣ Paiement rejeté par admin
const sendPaymentRejectedEmail = async (email, step, montant, commandeId, reason) => {
  await sendEmail(email, 5, { step, montant, commandeId, reason });
};

module.exports = {
  sendWelcomeEmail,
  sendNewOrderEmail,
  sendPaymentSubmittedEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
};
