Add-Type -AssemblyName System.Drawing
$source = [System.Drawing.Image]::FromFile('icon-512.png')
$dest192 = New-Object System.Drawing.Bitmap($source, 192, 192)
$dest192.Save('icon-192.png', [System.Drawing.Imaging.ImageFormat]::Png)
$dest180 = New-Object System.Drawing.Bitmap($source, 180, 180)
$dest180.Save('apple-touch-icon.png', [System.Drawing.Imaging.ImageFormat]::Png)
$source.Dispose()
$dest192.Dispose()
$dest180.Dispose()
Write-Host 'Icons generated successfully'