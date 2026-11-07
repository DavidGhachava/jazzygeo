# Little Georgian

A password-protected Georgian listening book with 12 levels and 865 clips.

## Deploy on Netlify

1. In Netlify, choose **Add new project → Import an existing project**, select GitHub, then select `DavidGhachava/jazzygeo` and the `main` branch. Leave the base directory at the repository root.
2. Add an environment variable named `PHRASEBOOK_PASSWORD`. Use the existing Little Georgian password and mark the value as a secret. If Netlify asks for scopes, enable **Functions**.
3. Deploy. Netlify reads the publish and function settings from `netlify.toml`. Open the deployed URL in a private window to check the password prompt, then unlock and play a clip.

The public directory contains only a robots file. The function bundles encrypted lesson and audio assets from `sealed/` and decrypts them after password verification. The password is supplied at runtime. Re-encrypt the assets with the new password before rotating it.

Pronunciation uses the existing Geo Learn library and additional clips from ElevenLabs and [Piper’s Georgian Natia voice](https://huggingface.co/rhasspy/piper-voices/blob/main/ka/ka_GE/natia/medium/MODEL_CARD), based on RHVoice’s Natia by Beqa Gozalishvili, Olga Yakovleva, and Vladimer Urdulashvili.
