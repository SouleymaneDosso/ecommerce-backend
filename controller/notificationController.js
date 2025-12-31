// backend/controller/notificationController.js
const SibApiV3Sdk = require("sib-api-v3-sdk");
const client = require("../utils/brevo");

const sendPaymentStepEmail = async (email, step, montant, totalSteps) => {
  try {
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi(client);

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail({
      to: [{ email }],
      templateId: 1, // Crée un template dans Brevo et mets l'ID ici
      params: {
        step,
        montant,
        totalSteps,
      },
      headers: { "X-Mailin-custom": "paiement-semi" },
      sender: { name: "Ton Site", email: "noreply@tonsite.com" },
    });

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Email envoyé pour étape", step);
  } catch (err) {
    console.error("Erreur envoi email Brevo:", err);
  }
};

module.exports = { sendPaymentStepEmail };
