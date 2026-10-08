package expo.modules.odwanmedia

import android.content.ContentUris
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Size
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

class OdwanMediaModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("OdwanMedia")

    // Decode, resize and publish on I/O workers, without transferring bitmap pixels to JS.
    AsyncFunction("generateThumbnail") Coroutine { source: String, assetId: String, video: Boolean, destinationUri: String ->
      withContext(Dispatchers.IO) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return@withContext null
        val context = appContext.reactContext ?: return@withContext null
        val sourceUri = Uri.parse(source)
        val uri = if (sourceUri.scheme == "content") sourceUri else {
          val id = assetId.toLongOrNull() ?: return@withContext null
          ContentUris.withAppendedId(
            if (video) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            id
          )
        }
        val outputUri = Uri.parse(destinationUri)
        require(outputUri.scheme == "file") { "A local thumbnail destination is required." }
        val directory = File(appContext.persistentFilesDirectory, "media-thumbnails-v1").canonicalFile
        val output = File(requireNotNull(outputUri.path)).canonicalFile
        require(output.parentFile == directory && output.name.matches(Regex("[a-f0-9]{64}\\.jpg"))) {
          "Invalid thumbnail destination."
        }
        var original: Bitmap? = null
        var resized: Bitmap? = null
        var temporary: File? = null
        try {
          original = context.contentResolver.loadThumbnail(uri, Size(256, 256), null)
          val bitmap = requireNotNull(original)
          val ratio = minOf(1f, 256f / max(bitmap.width, bitmap.height))
          resized = if (ratio < 1f) Bitmap.createScaledBitmap(bitmap,
            max(1, (bitmap.width * ratio).roundToInt()), max(1, (bitmap.height * ratio).roundToInt()), true) else bitmap
          check(directory.exists() || directory.mkdirs()) { "Could not create thumbnail directory." }
          temporary = File(directory, "${UUID.randomUUID()}.tmp")
          temporary.outputStream().use { stream ->
            check(requireNotNull(resized).compress(Bitmap.CompressFormat.JPEG, 40, stream)) { "Could not encode thumbnail." }
          }
          check(temporary.renameTo(output)) { "Could not publish thumbnail." }
          Uri.fromFile(output).toString()
        } catch (_: IOException) {
          // Providers without thumbnail support use the existing Expo decoder.
          null
        } catch (_: UnsupportedOperationException) {
          null
        } finally {
          temporary?.delete()
          if (resized !== original) resized?.recycle()
          original?.recycle()
        }
      }
    }
  }
}
