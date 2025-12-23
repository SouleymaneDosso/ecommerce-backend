const User = require("../models/User");
const crypto = require("crypto");
const SibApiV3Sdk = require("sib-api-v3-sdk");

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email requis" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    // Création d’un token temporaire
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpire = Date.now() + 3600000; // 1h
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetTokenExpire;
    await user.save();

    // Préparer l’email
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: user.email }];
    sendSmtpEmail.sender = { email: "no-reply@tonsite.com", name: "Mon E-commerce" };
    sendSmtpEmail.subject = "Réinitialisation de votre mot de passe";
    sendSmtpEmail.htmlContent = `<p>Bonjour ${user.username},</p>
      <p>Cliquez <a href="${process.env.CLIENT_URL}/reset-password/${resetToken}">ici</a> pour réinitialiser votre mot de passe. Ce lien est valable 1h.</p>`;

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.status(200).json({ message: "Email de réinitialisation envoyé" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ message: "Token et mot de passe requis" });

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ message: "Token invalide ou expiré" });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: "Mot de passe réinitialisé avec succès" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
