const User = require("../models/User");
const crypto = require("crypto");
const SibApiV3Sdk = require("sib-api-v3-sdk");

/* =========================
   CONFIG BREVO
   ========================= */
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

/* =========================
   DEMANDE RESET PASSWORD
   ========================= */
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email requis" });
  }

  try {
    const user = await User.findOne({ email });

    // ⚠️ Sécurité : toujours la même réponse
    if (!user) {
      return res.status(200).json({
        message:
          "Si un compte existe avec cet email, un message de réinitialisation a été envoyé",
      });
    }

    // Génération token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash du token pour stockage DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 heure
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // Email Brevo
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    sendSmtpEmail.to = [{ email: user.email }];
    sendSmtpEmail.sender = {
      email: "no-reply@numa.com",
      name: "NUMA",
    };
    sendSmtpEmail.subject = "Réinitialisation de votre mot de passe";
    sendSmtpEmail.htmlContent = `
      <p>Bonjour <strong>${user.username}</strong>,</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p>
        👉 <a href="${resetUrl}">Cliquez ici pour réinitialiser votre mot de passe</a>
      </p>
      <p>Ce lien est valable <strong>1 heure</strong>.</p>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      <br/>
      <p>— L'équipe NUMA</p>
    `;

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.status(200).json({
      message:
        "Si un compte existe avec cet email, un message de réinitialisation a été envoyé",
    });
  } catch (err) {
    console.error("❌ requestPasswordReset:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/* =========================
   RESET PASSWORD
   ========================= */
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res
      .status(400)
      .json({ message: "Token et mot de passe requis" });
  }

  try {
    // Hash du token reçu
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "Token invalide ou expiré" });
    }

    // ⚠️ Le hash du password doit être fait dans le UserSchema (pre save)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (err) {
    console.error("❌ resetPassword:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
