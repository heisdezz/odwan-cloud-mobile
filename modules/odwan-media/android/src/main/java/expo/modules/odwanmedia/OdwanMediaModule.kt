package expo.modules.odwanmedia

import android.content.ContentUris
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
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

    // HTTP is downloaded separately with cancellation. Only private cache files
    // reach the retriever, and parsing/encoding never runs on Expo's shared queue.
    AsyncFunction("generateFileVideoThumbnail") Coroutine { source: String, destinationUri: String ->
      withContext(Dispatchers.IO) {
        val uri = Uri.parse(source)
        require(uri.scheme == "file") { "Video thumbnail decoding requires a local file." }
        val input = File(requireNotNull(uri.path)).canonicalFile
        val sources = File(appContext.cacheDirectory, "thumbnail-sources").canonicalFile
        require(input.parentFile == sources && input.isFile) { "Invalid video thumbnail source." }
        val retriever = MediaMetadataRetriever()
        var bitmap: Bitmap? = null
        try {
          retriever.setDataSource(input.path)
          bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1)
            retriever.getScaledFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 256, 256)
          else retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
          publishThumbnail(requireNotNull(bitmap) { "No video preview could be generated." }, destinationUri)
        } finally {
          bitmap?.recycle()
          retriever.release()
        }
      }
    }

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
        var original: Bitmap? = null
        try {
          original = context.contentResolver.loadThumbnail(uri, Size(256, 256), null)
          publishThumbnail(requireNotNull(original), destinationUri)
        } catch (_: IOException) {
          // Providers without thumbnail support use the existing Expo decoder.
          null
        } catch (_: UnsupportedOperationException) {
          null
        } finally {
          original?.recycle()
        }
      }
    }
  }

  private fun publishThumbnail(bitmap: Bitmap, destinationUri: String): String {
    val uri = Uri.parse(destinationUri)
    require(uri.scheme == "file") { "A local thumbnail destination is required." }
    val directory = File(appContext.persistentFilesDirectory, "media-thumbnails-v1").canonicalFile
    val output = File(requireNotNull(uri.path)).canonicalFile
    require(output.parentFile == directory && output.name.matches(Regex("[a-f0-9]{64}\\.jpg"))) {
      "Invalid thumbnail destination."
    }
    val ratio = minOf(1f, 256f / max(bitmap.width, bitmap.height))
    val resized = if (ratio < 1f) Bitmap.createScaledBitmap(bitmap,
      max(1, (bitmap.width * ratio).roundToInt()), max(1, (bitmap.height * ratio).roundToInt()), true) else bitmap
    val temporary = File(directory, "${UUID.randomUUID()}.tmp")
    try {
      check(directory.exists() || directory.mkdirs()) { "Could not create thumbnail directory." }
      temporary.outputStream().use { stream ->
        check(resized.compress(Bitmap.CompressFormat.JPEG, 40, stream)) { "Could not encode thumbnail." }
      }
      check(temporary.renameTo(output)) { "Could not publish thumbnail." }
      return Uri.fromFile(output).toString()
    } finally {
      temporary.delete()
      if (resized !== bitmap) resized.recycle()
    }
  }
}
