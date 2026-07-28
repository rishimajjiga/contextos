package com.usecontextos.app.bubble.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

data class BubbleMemory(
    val id: String,
    val title: String,
    val content: String,
    val docType: String,
    val createdAt: String?,
)

data class BubbleProject(
    val id: String,
    val name: String,
    val description: String?,
)

data class BubbleUserInfo(val email: String?)
data class BubblePlanInfo(val displayName: String)
data class BubbleTeamInfo(val hasTeam: Boolean, val teamName: String?)

/** Mirrors extension/background.js's error taxonomy (AUTH_ERROR / LIMIT_REACHED / NETWORK_ERROR)
 * closely enough that the panel can react the same way: prompt re-auth, show a plan-limit
 * message, or show an offline state. */
sealed class BubbleApiError(message: String) : Exception(message) {
    class NotConfigured : BubbleApiError("Sign in to ContextOS first.")
    class Auth : BubbleApiError("Your ContextOS connection expired. Sign in again.")
    class LimitReached(val detail: String) : BubbleApiError(detail)
    class Network(message: String) : BubbleApiError(message)
    class Server(val status: Int, message: String) : BubbleApiError(message)
}

/**
 * Talks to the same ContextOS backend the Chrome extension does, the same way: a ctxos_ API
 * key in the X-Api-Key header (see BubbleCredentialStore) rather than the WebView's Clerk
 * session — an entirely separate, native-owned credential. Endpoints and response shapes are
 * intentionally identical to extension/background.js's apiRequest() call sites so this stays a
 * faithful port, not a reinterpretation.
 */
class ContextOSApi(private val context: Context) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun health(): Boolean = healthCheck(BubbleCredentialStore.getApiUrl(context))

    /** Independent of stored credentials — used by the Connect tab's "Test" button to validate
     * a backend URL the user just typed, before (or without) saving it. */
    suspend fun healthCheck(baseUrl: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val normalized = baseUrl.trimEnd('/')
            val request = Request.Builder().url("$normalized/health").build()
            client.newCall(request).execute().use { it.isSuccessful }
        } catch (e: IOException) {
            false
        } catch (e: IllegalArgumentException) {
            false // malformed URL typed by the user
        }
    }

    // scope=personal matches the website's own MemoriesPage default exactly (memory.service.ts
    // list()) — without it, results mix in team memories the user might not expect to see in a
    // plain "Memory" tab. limit is additive: the website itself doesn't set one (desktop can
    // afford an unbounded list), but the extension's proven pattern of capping it is worth
    // keeping for a phone-sized panel.
    suspend fun listMemories(limit: Int = 12): List<BubbleMemory> {
        val body = request("GET", "/api/v1/memories?scope=personal&limit=$limit")
        return parseMemories(body)
    }

    suspend fun searchMemories(query: String, limit: Int = 12): List<BubbleMemory> {
        val encoded = java.net.URLEncoder.encode(query, "UTF-8")
        val body = request("GET", "/api/v1/memories?scope=personal&q=$encoded&limit=$limit")
        return parseMemories(body)
    }

    /** visibility mirrors the website's exact field values (SaveMemoryPage.tsx / memory.service.ts
     * CreateMemoryPayload) — "private" (default) or "team", never "personal": that's a client-side
     * UI concept, not a value the API itself accepts. */
    suspend fun saveMemory(
        title: String,
        content: String,
        tags: List<String> = emptyList(),
        projectId: String? = null,
        visibility: String? = null,
    ) {
        val payload = JSONObject().apply {
            put("title", title)
            put("content", content)
            put("tags", JSONArray(tags))
            put("project_id", projectId)
            if (visibility != null) put("visibility", visibility)
        }
        request("POST", "/api/v1/memories", payload)
    }

    suspend fun listProjects(): List<BubbleProject> {
        val body = request("GET", "/api/v1/projects?page=1&per_page=50")
        val root = if (body is JSONObject) body else JSONObject()
        val items = root.optJSONArray("items") ?: JSONArray()
        return (0 until items.length()).map { i ->
            val p = items.getJSONObject(i)
            BubbleProject(
                id = p.optString("id"),
                name = p.optString("name", "Unnamed"),
                description = p.optString("description", "").ifBlank { null },
            )
        }
    }

    suspend fun getUserInfo(): BubbleUserInfo {
        val body = request("GET", "/api/v1/users/me") as? JSONObject ?: JSONObject()
        return BubbleUserInfo(email = body.optString("email", "").ifBlank { null })
    }

    suspend fun getPlan(): BubblePlanInfo {
        val body = request("GET", "/api/v1/billing/plan") as? JSONObject ?: JSONObject()
        return BubblePlanInfo(displayName = body.optString("display_name", "Free"))
    }

    suspend fun getTeamInfo(): BubbleTeamInfo {
        return try {
            val body = request("GET", "/api/v1/organizations") as? JSONObject ?: JSONObject()
            val id = body.optString("id", "")
            if (id.isBlank()) BubbleTeamInfo(false, null)
            else BubbleTeamInfo(true, body.optString("name", "").ifBlank { null })
        } catch (e: BubbleApiError) {
            BubbleTeamInfo(false, null) // not on a team / not reachable — treat as personal-only
        }
    }

    private fun parseMemories(body: Any?): List<BubbleMemory> {
        val items = when (body) {
            is JSONArray -> body
            is JSONObject -> body.optJSONArray("items") ?: JSONArray()
            else -> JSONArray()
        }
        return (0 until items.length()).map { i ->
            val m = items.getJSONObject(i)
            BubbleMemory(
                id = m.optString("id"),
                title = m.optString("title", "Untitled"),
                content = m.optString("content", ""),
                docType = m.optString("doc_type", "note"),
                createdAt = m.optString("created_at", "").ifBlank { null },
            )
        }
    }

    /** Returns a JSONObject or JSONArray depending on the endpoint's response shape. */
    private suspend fun request(method: String, path: String, jsonBody: JSONObject? = null): Any =
        withContext(Dispatchers.IO) {
            val apiKey = BubbleCredentialStore.getApiKey(context) ?: throw BubbleApiError.NotConfigured()
            val base = BubbleCredentialStore.getApiUrl(context)

            val builder = Request.Builder()
                .url("$base$path")
                .header("X-Api-Key", apiKey)
                .header("Content-Type", "application/json")

            when (method) {
                "POST" -> builder.post((jsonBody ?: JSONObject()).toString().toRequestBody(jsonMedia))
                "DELETE" -> builder.delete()
                else -> builder.get()
            }

            val response = try {
                client.newCall(builder.build()).execute()
            } catch (e: IOException) {
                throw BubbleApiError.Network("Cannot reach ContextOS. Check your connection.")
            }

            response.use { res ->
                when (res.code) {
                    401, 403 -> throw BubbleApiError.Auth()
                    402 -> {
                        val detail = res.body?.string().orEmpty()
                        throw BubbleApiError.LimitReached(detail.ifBlank { "Plan limit reached." })
                    }
                    else -> {
                        if (!res.isSuccessful) {
                            throw BubbleApiError.Server(res.code, "Server error ${res.code}")
                        }
                        val text = res.body?.string().orEmpty()
                        if (text.isBlank()) return@use JSONObject()
                        return@use if (text.trimStart().startsWith("[")) JSONArray(text) else JSONObject(text)
                    }
                }
            }
        }
}
