Add-Type -AssemblyName System.Drawing

$logoPath = 'D:\Stockly React\public\Stockly Logo.jpg'
if (!(Test-Path $logoPath)) {
    Write-Error "Logo not found at $logoPath"
    exit 1
}

$src = [System.Drawing.Bitmap]::FromFile($logoPath)

function Resize-Image($bmp, [int]$width, [int]$height, [string]$outPath, [bool]$fitInside = $false, $bgColor = $null) {
    $dest = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($null -ne $bgColor) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $g.FillRectangle($brush, 0, 0, $width, $height)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    if ($fitInside) {
        # Safe-zone margin for Android adaptive icon foreground (central 72%)
        $scale = [Math]::Min(($width * 0.72) / $bmp.Width, ($height * 0.72) / $bmp.Height)
        $dw = [int]($bmp.Width * $scale)
        $dh = [int]($bmp.Height * $scale)
        $dx = [int](($width - $dw) / 2)
        $dy = [int](($height - $dh) / 2)
        $g.DrawImage($bmp, $dx, $dy, $dw, $dh)
    } else {
        $g.DrawImage($bmp, 0, 0, $width, $height)
    }

    $g.Dispose()

    $parent = Split-Path $outPath -Parent
    if (!(Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Created $outPath"
}

# 1. Web and PWA icons
Resize-Image $src 512 512 'D:\Stockly React\public\icons\icon-512.png' $false $null
Resize-Image $src 192 192 'D:\Stockly React\public\icons\icon-192.png' $false $null
Resize-Image $src 180 180 'D:\Stockly React\public\icons\apple-touch-icon.png' $false $null
Resize-Image $src 64 64 'D:\Stockly React\public\favicon.ico' $false $null

# 2. Android Mipmap icons
$white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

$mipmaps = @(
    @{ folder = 'mipmap-mdpi'; size = 48; fg = 108 },
    @{ folder = 'mipmap-hdpi'; size = 72; fg = 162 },
    @{ folder = 'mipmap-xhdpi'; size = 96; fg = 216 },
    @{ folder = 'mipmap-xxhdpi'; size = 144; fg = 324 },
    @{ folder = 'mipmap-xxxhdpi'; size = 192; fg = 432 }
)

foreach ($m in $mipmaps) {
    $dir = "D:\Stockly React\android\app\src\main\res\$($m.folder)"
    Resize-Image $src $m.size $m.size "$dir\ic_launcher.png" $false $white
    Resize-Image $src $m.size $m.size "$dir\ic_launcher_round.png" $false $white
    Resize-Image $src $m.fg $m.fg "$dir\ic_launcher_foreground.png" $true $null
}

# 3. Android Splash screens
# Splash image centered on theme background
$themeBg = [System.Drawing.Color]::FromArgb(255, 26, 31, 38) # #1a1f26

function Make-Splash($bmp, [int]$w, [int]$h, [string]$outPath, $bg) {
    $dest = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    $brush = New-Object System.Drawing.SolidBrush($bg)
    $g.FillRectangle($brush, 0, 0, $w, $h)
    $brush.Dispose()

    # Draw logo centered, max 200px or 40% of smallest dimension
    $targetDim = [Math]::Min(240, [int]([Math]::Min($w, $h) * 0.45))
    $dx = [int](($w - $targetDim) / 2)
    $dy = [int](($h - $targetDim) / 2)
    
    # Draw rounded or clean logo
    $g.DrawImage($bmp, $dx, $dy, $targetDim, $targetDim)
    $g.Dispose()

    $parent = Split-Path $outPath -Parent
    if (!(Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()
    Write-Host "Created Splash $outPath"
}

# Generate splash for drawable and all port/land sizes
Make-Splash $src 480 800 'D:\Stockly React\android\app\src\main\res\drawable\splash.png' $themeBg
Make-Splash $src 320 480 'D:\Stockly React\android\app\src\main\res\drawable-port-mdpi\splash.png' $themeBg
Make-Splash $src 480 800 'D:\Stockly React\android\app\src\main\res\drawable-port-hdpi\splash.png' $themeBg
Make-Splash $src 720 1280 'D:\Stockly React\android\app\src\main\res\drawable-port-xhdpi\splash.png' $themeBg
Make-Splash $src 960 1600 'D:\Stockly React\android\app\src\main\res\drawable-port-xxhdpi\splash.png' $themeBg
Make-Splash $src 1280 1920 'D:\Stockly React\android\app\src\main\res\drawable-port-xxxhdpi\splash.png' $themeBg

Make-Splash $src 480 320 'D:\Stockly React\android\app\src\main\res\drawable-land-mdpi\splash.png' $themeBg
Make-Splash $src 800 480 'D:\Stockly React\android\app\src\main\res\drawable-land-hdpi\splash.png' $themeBg
Make-Splash $src 1280 720 'D:\Stockly React\android\app\src\main\res\drawable-land-xhdpi\splash.png' $themeBg
Make-Splash $src 1600 960 'D:\Stockly React\android\app\src\main\res\drawable-land-xxhdpi\splash.png' $themeBg
Make-Splash $src 1920 1280 'D:\Stockly React\android\app\src\main\res\drawable-land-xxxhdpi\splash.png' $themeBg

$src.Dispose()
Write-Host "All icons and splash screens successfully generated!"