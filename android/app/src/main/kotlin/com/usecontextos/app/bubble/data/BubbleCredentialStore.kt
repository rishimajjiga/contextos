package com.usecontextos.app.bubble.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.usecontextos.app.util.Constants
import com.usecontextos.app.util.CrashLogger

/**
 * The single source of truth for the ctxos_ API key across ALL native ContextOS surfaces —
 * the floating bubble panel, the "Save to ContextOS" text-selection action, and the extension
 * connect flow. They deliberately share one key so that connecting any one of them connects
 * every one of them: there is no separate "reconnect the selection-save" step, because there is
 * no separate credential to reconnect.
 *
 * Two backing stores are kept in sync on every write:
 *  - an EncryptedSharedPreferences file (primary — encrypted at rest, since a ctxos_ key is a
 *    bearer credential), and
 *  - the plain SharedPreferences slot the extension connect flow already used
 *    (Constants.PREF_EXT_API_KEY), which existing code — e.g. the connect-extension popup shim —
 *    reads directly.
 * Reads prefer the encrypted store and fall back to the extension slot, so a key written by
 * EITHER path is visible to ALL of them.
 *
 * This is NOT the WebView's Clerk session (short-lived, per-cookie-jar) — it's the stable key
 * native code holds and sends as X-Api-Key, minted from the Clerk session on first sign-in
 * (see MainActivity.BUBBLE_AUTO_MINT_SCRIPT / WebAppBridge.onBubbleKeyMinted).
 */
object BubbleCredentialStore {
    private const val FILE_NAME = "contextos_bubble_secure"
    private const val KEY_API_KEY = "api_key"
    private const val KEY_API_URL = "api_url"

    private fun encrypted(context: Context): SharedPreferences? {
        return try {
            val masterKey = MasterKey.Builder(context.applicationContext)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context.applicationContext,
                FILE_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        } catch (e: Exception) {
            // Never crash the host app over a storage-layer failure (e.g. Keystore
            // unavailable on some OEM builds) — fall back to the extension slot below.
            CrashLogger.e("Bubble", "EncryptedSharedPreferences unavailable", e)
            null
        }
    }

    private fun extStore(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(Constants.PREFS_NAME, Context.MODE_PRIVATE)

    fun saveApiKey(context: Context, apiKey: String, apiUrl: String) {
        val enc = encrypted(context)
        if (enc != null) {
            enc.edit()
                .putString(KEY_API_KEY, apiKey)
                .putString(KEY_API_URL, apiUrl)
                .apply()
            // Encrypted write succeeded → no plaintext copy of the key may remain. (Verified:
            // nothing reads the plaintext slot except this object's own fallback below, so
            // removing it changes nothing for keystore-healthy devices — it also migrates old
            // installs off their pre-existing plaintext copy on the next save.) The URL is not
            // sensitive and stays mirrored for getApiUrl's fallback.
            extStore(context).edit()
                .remove(Constants.PREF_EXT_API_KEY)
                .putString(Constants.PREF_EXT_API_URL, apiUrl)
                .apply()
        } else {
            // Keystore unavailable on this device (rare OEM failure, logged in encrypted()) —
            // the plaintext slot is the only store that can keep the feature working at all.
            extStore(context).edit()
                .putString(Constants.PREF_EXT_API_KEY, apiKey)
                .putString(Constants.PREF_EXT_API_URL, apiUrl)
                .apply()
        }
    }

    fun getApiKey(context: Context): String? {
        val fromEncrypted = encrypted(context)?.getString(KEY_API_KEY, null)
        if (!fromEncrypted.isNullOrBlank()) return fromEncrypted
        // Fall back to whatever the extension connect flow stored — so selection-save/bubble
        // work whenever the extension is connected, with no separate reconnect.
        return extStore(context).getString(Constants.PREF_EXT_API_KEY, null)?.takeIf { it.isNotBlank() }
    }

    fun getApiUrl(context: Context): String {
        val fromEncrypted = encrypted(context)?.getString(KEY_API_URL, null)
        if (!fromEncrypted.isNullOrBlank()) return fromEncrypted
        return extStore(context).getString(Constants.PREF_EXT_API_URL, null)?.takeIf { it.isNotBlank() }
            ?: DEFAULT_API_URL
    }

    fun isSignedIn(context: Context): Boolean = !getApiKey(context).isNullOrBlank()

    /** Clears BOTH stores — a disconnect (or a stale-key self-heal) must reset the one shared
     * credential everywhere, or a lingering copy in the other store would defeat it. */
    fun clear(context: Context) {
        encrypted(context)?.edit()?.clear()?.apply()
        extStore(context).edit()
            .remove(Constants.PREF_EXT_API_KEY)
            .remove(Constants.PREF_EXT_API_URL)
            .apply()
    }

    const val DEFAULT_API_URL = "https://api.usecontextos.com"
}
