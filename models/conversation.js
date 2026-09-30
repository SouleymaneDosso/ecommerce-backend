const mongoose = require("mongoose");

const convSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    livreurId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Livreur",
      required: true,
    },

    commandeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commandeapi",
      required: true,
    },

    derniermessage: {
      type: String,
      default: "",
    },

    messages: [
      {
        message: {
          type: String,
          required: true,
        },

        expediteur: {
          id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
          },

          type: {
            type: String,
            enum: ["client", "livreur"],
            required: true,
          },
        },

        lu: {
          type: Boolean,
          default: false,
        },

        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);
convSchema.index(
  { clientId: 1, livreurId: 1, commandeId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Conversation", convSchema);