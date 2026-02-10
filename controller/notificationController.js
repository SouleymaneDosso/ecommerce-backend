// notificationController.js
const SibApiV3Sdk = require("sib-api-v3-sdk");

// 🔹 Configuration Brevo
const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi(client);

// Fonction générique pour envoyer un email
const sendEmail = async (toEmail, templateId, params) => {
  try {
    const sendSmtpEmail = {
      to: [{ email: toEmail }],
      templateId,
      params,
      sender: { name: "NUMA", email: "contact@numa.luxe" },
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email envoyé (${templateId}) à ${toEmail}`);
  } catch (err) {
    console.error(
      "❌ Erreur envoi email Brevo:",
      err?.response?.body || err.message,
    );
  }
};

// ======= FONCTIONS PAR TEMPLATE =======

// 1️⃣ Bienvenue / création de compte
const sendWelcomeEmail = async (email, username) => {
  await sendEmail(email, 7, { username });
};

// 2️⃣ Nouvelle commande
const sendNewOrderEmail = async (email, commande) => {
  if (!commande) {
    console.error("❌ sendNewOrderEmail: commande undefined");
    return;
  }

  // Générer le HTML du panier
  const panierHTML = (commande.panier || [])
    .map((item) => `- ${item.nom} (${item.quantite} x ${item.prix} FCFA)`)
    .join("<br>");

  // Créer l'objet params pour Brevo
  const params = {
    nom: `${commande.client.nom} ${commande.client.prenom}`,
    commandeId: commande._id,
    total: commande.total,
    panierHTML,
  };

  // Envoyer l'email via Brevo
  await sendEmail(email, 3, params);
};

// 3️⃣ Paiement soumis par le client
const sendPaymentSubmittedEmail = async (email, step, montant, commandeId) => {
  await sendEmail(email, 4, { step, montant, commandeId });
};

// 4️⃣ Paiement confirmé par admin
const sendPaymentConfirmedEmail = async (email, step, montant, commandeId) => {
  await sendEmail(email, 5, { step, montant, commandeId });
};

// 5️⃣ Paiement rejeté par admin
const sendPaymentRejectedEmail = async (
  email,
  step,
  montant,
  commandeId,
  reason,
) => {
  await sendEmail(email, 6, { step, montant, commandeId, reason });
};

module.exports = {
  sendWelcomeEmail,
  sendNewOrderEmail,
  sendPaymentSubmittedEmail,
  sendPaymentConfirmedEmail,
  sendPaymentRejectedEmail,
};
