# List available audio input devices using ffmpeg
$ffmpegPath = "C:\Users\Owen\dev\MacroVox\ffmpeg-8.0-full_build\ffmpeg-8.0-full_build\bin\ffmpeg.exe"

Write-Host "Listing available audio input devices..." -ForegroundColor Cyan
Write-Host ""

& $ffmpegPath -list_devices true -f dshow -i dummy 2>&1 | Select-String "DirectShow audio devices" -Context 0,20

Write-Host ""
Write-Host "Copy the exact device name and update src/audio.js line 24:" -ForegroundColor Yellow
Write-Host "  '-i', 'audio=`"YOUR_DEVICE_NAME`"'," -ForegroundColor Green
