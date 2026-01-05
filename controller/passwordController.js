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
  console.log("🚀 Requête reçue pour forgot-password :", req.body);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email requis" });
  }

  try {
    const user = await User.findOne({ email });

    // 🔒 Sécurité : réponse identique
    if (!user) {
      return res.status(200).json({
        message:
          "Si un compte existe avec cet email, un message de réinitialisation a été envoyé",
      });
    }

    // 🔑 Génération token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1h
    await user.save();

    const resetUrl = `https://numa.luxe/reset-password/${resetToken}`;

    /* =========================
       EMAIL VIA TEMPLATE BREVO
    ========================= */
    const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      to: [{ email: user.email }],
      sender: {
        email: "contact@numa.luxe",
        name: "NUMA",
      },
      templateId: 8, // 👈 ID DU TEMPLATE BREVO
      params: {
        username: user.username,
        resetUrl: resetUrl,
      },
    };

    try {
      await apiInstance.sendTransacEmail(sendSmtpEmail);
      console.log("✅ Email reset envoyé via Brevo à", user.email);
    } catch (err) {
      console.error("❌ Erreur Brevo :", err?.response?.body || err);
      // ⚠️ on ne bloque jamais le flow
    }

    return res.status(200).json({
      message:
        "Si un compte existe avec cet email, un message de réinitialisation a été envoyé",
    });
  } catch (err) {
    console.error("❌ requestPasswordReset:", err);
    return res.status(500).json({ message: "Erreur serveur" });
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

    user.password = password; // hash auto via pre-save
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    return res.status(200).json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (err) {
    console.error("❌ resetPassword:", err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
