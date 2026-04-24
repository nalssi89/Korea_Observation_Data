param(
  [string]$InputPath = "data/output/final/region_monthly.md",
  [string]$OutputDir = "data/output/final/region_sign_calendars"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$LastCompleteYear = 2026
$LastCompleteMonth = 3
$NormalStart = 1991
$NormalEnd = 2020
$Variables = @("tavg", "tmin", "tmax", "precip")
$Months = 1..12
$MonthSuffix = [string][char]0xC6D4
$YearSuffix = [string][char]0xB144

$Rows = Import-Csv -Path $InputPath | Where-Object {
  $year = [int]$_.year
  $expectedPeriod = $(if ($year -le 1989) { "1973_1989" } else { "1990_latest" })
  $_.period_group -eq $expectedPeriod
}

$Rows = $Rows | Where-Object {
  ([int]$_.year -lt $LastCompleteYear) -or
  (([int]$_.year -eq $LastCompleteYear) -and ([int]$_.month -le $LastCompleteMonth))
}

$Regions = $Rows | ForEach-Object { $_.region_name } | Sort-Object -Unique
$Years = 1973..2026

$FontFamily = "Malgun Gothic"
$TitleFont = New-Object System.Drawing.Font($FontFamily, 18, [System.Drawing.FontStyle]::Bold)
$SubtitleFont = New-Object System.Drawing.Font($FontFamily, 9, [System.Drawing.FontStyle]::Regular)
$LabelFont = New-Object System.Drawing.Font($FontFamily, 8, [System.Drawing.FontStyle]::Regular)
$CellFont = New-Object System.Drawing.Font($FontFamily, 6.5, [System.Drawing.FontStyle]::Bold)
$BrushDark = [System.Drawing.Brushes]::Black
$MissingColor = [System.Drawing.Color]::FromArgb(230, 230, 226)

$Specs = @(
  @{
    Variable = "tavg"; Heading = "Mean Temperature"; ValueField = "departure"; NormalField = "tavg";
    Minus = [System.Drawing.Color]::FromArgb(166,206,227); Similar = [System.Drawing.Color]::FromArgb(246,238,202); Plus = [System.Drawing.Color]::FromArgb(244,161,151)
  },
  @{
    Variable = "tmin"; Heading = "Minimum Temperature"; ValueField = "departure"; NormalField = "tmin";
    Minus = [System.Drawing.Color]::FromArgb(168,207,232); Similar = [System.Drawing.Color]::FromArgb(246,238,202); Plus = [System.Drawing.Color]::FromArgb(241,170,159)
  },
  @{
    Variable = "tmax"; Heading = "Maximum Temperature"; ValueField = "departure"; NormalField = "tmax";
    Minus = [System.Drawing.Color]::FromArgb(173,216,230); Similar = [System.Drawing.Color]::FromArgb(246,238,202); Plus = [System.Drawing.Color]::FromArgb(238,145,135)
  },
  @{
    Variable = "precip"; Heading = "Precipitation"; ValueField = "observed"; NormalField = "precip";
    Minus = [System.Drawing.Color]::FromArgb(176,125,60); Similar = [System.Drawing.Color]::FromArgb(236,226,198); Plus = [System.Drawing.Color]::FromArgb(89,154,104)
  }
)

function New-Canvas([int]$Width, [int]$Height) {
  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(251, 250, 245))
  return @($bitmap, $graphics)
}

function Save-Canvas($Bitmap, $Graphics, [string]$Path) {
  $Graphics.Dispose()
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Bitmap.Dispose()
}

function Format-OneDecimal([double]$Value) {
  return "{0:F1}" -f ([Math]::Round($Value, 1))
}

function Get-SignColor($Spec, [string]$Sign) {
  if ($Sign -eq "-") { return $Spec.Minus }
  if ($Sign -eq "+") { return $Spec.Plus }
  if ($Sign -eq "0") { return $Spec.Similar }
  return $MissingColor
}

function Get-Slug([int]$Index, [string]$RegionName) {
  $safe = $RegionName -replace "[^\p{L}\p{Nd}]+", "_"
  $safe = $safe.Trim("_")
  return ("{0:D2}_{1}" -f $Index, $safe)
}

function Get-Quantile($Values, [double]$Probability) {
  $sorted = @($Values | Sort-Object)
  if ($sorted.Count -eq 0) { return $null }
  if ($sorted.Count -eq 1) { return [double]$sorted[0] }

  $position = ($sorted.Count - 1) * $Probability
  $lowerIndex = [Math]::Floor($position)
  $upperIndex = [Math]::Ceiling($position)
  $lower = [double]$sorted[$lowerIndex]
  $upper = [double]$sorted[$upperIndex]
  if ($lowerIndex -eq $upperIndex) { return $lower }

  $weight = $position - $lowerIndex
  return $lower + (($upper - $lower) * $weight)
}

function Get-Sign([double]$Value, [double]$P33, [double]$P66) {
  if ($Value -lt $P33) { return "-" }
  if ($Value -gt $P66) { return "+" }
  return "0"
}

function Draw-Legend($Graphics, $Spec, [int]$X, [int]$Y) {
  $items = @(
    @{ Sign = "-"; Label = $(if ($Spec.Variable -eq "precip") { "Dry" } else { "Low" }) },
    @{ Sign = "0"; Label = "Similar" },
    @{ Sign = "+"; Label = $(if ($Spec.Variable -eq "precip") { "Wet" } else { "High" }) },
    @{ Sign = ""; Label = "Missing" }
  )
  for ($i = 0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $px = $X + $i * 110
    $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $Spec $item.Sign))
    $Graphics.FillRectangle($brush, $px, $Y, 15, 15)
    $brush.Dispose()
    $Graphics.DrawString("$($item.Sign) $($item.Label)", $LabelFont, $BrushDark, $px + 21, $Y - 1)
  }
}

function Build-RegionVariableRows([string]$RegionName, $Spec, $AllRows) {
  $field = $Spec.NormalField
  $regionRows = @($AllRows | Where-Object { $_.region_name -eq $RegionName })
  $result = @{}

  foreach ($month in $Months) {
    $normalRows = @(
      $regionRows | Where-Object {
        [int]$_.year -ge $NormalStart -and
        [int]$_.year -le $NormalEnd -and
        [int]$_.month -eq $month -and
        $_.$field -ne $null -and
        $_.$field -ne ""
      }
    )
    if ($normalRows.Count -lt 30) {
      continue
    }

    $normalValues = @($normalRows | ForEach-Object { [double]$_.$field })
    $normalMean = ($normalValues | Measure-Object -Average).Average
    $p33 = Get-Quantile $normalValues 0.3333
    $p66 = Get-Quantile $normalValues 0.6667

    foreach ($row in @($regionRows | Where-Object { [int]$_.month -eq $month })) {
      $year = [int]$row.year
      if ($year -eq $LastCompleteYear -and [int]$row.month -gt $LastCompleteMonth) {
        continue
      }
      $observed = [double]$row.$field
      $departure = $observed - $normalMean
      $sign = Get-Sign $observed $p33 $p66
      $value = $(if ($Spec.Variable -eq "precip") { $observed } else { $departure })
      $result["${year}:${month}"] = @{
        Value = [double]$value
        Sign = $sign
        StationCount = [int]$row.station_count_used
      }
    }
  }

  return $result
}

function Draw-SignCalendar([string]$RegionName, [string]$Slug, $Spec, $Data) {
  $cellW = 68
  $cellH = 18
  $gap = 2
  $left = 92
  $top = 88
  $width = $left + 12 * ($cellW + $gap) + 34
  $height = $top + $Years.Count * ($cellH + $gap) + 92
  $canvas = New-Canvas $width $height
  $bitmap = $canvas[0]
  $graphics = $canvas[1]

  $graphics.DrawString("$RegionName - $($Spec.Heading)", $TitleFont, $BrushDark, 26, 18)
  $graphics.DrawString("1991-2020 fixed normal, middle tercile range = 0", $SubtitleFont, [System.Drawing.Brushes]::DimGray, 28, 44)
  $graphics.DrawString("Temperature cells show departure; precipitation cells show observed monthly precipitation.", $SubtitleFont, [System.Drawing.Brushes]::DimGray, 28, 60)

  foreach ($month in $Months) {
    $x = $left + ($month - 1) * ($cellW + $gap)
    $graphics.DrawString("$month$MonthSuffix", $LabelFont, $BrushDark, $x + 21, 72)
  }

  for ($yi = 0; $yi -lt $Years.Count; $yi++) {
    $year = [int]$Years[$yi]
    $y = $top + $yi * ($cellH + $gap)
    $graphics.DrawString([string]$year, $LabelFont, [System.Drawing.Brushes]::DimGray, 42, $y - 1)

    foreach ($month in $Months) {
      $x = $left + ($month - 1) * ($cellW + $gap)
      $entry = $Data["${year}:${month}"]
      $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $Spec $entry.Sign))
      $graphics.FillRectangle($brush, $x, $y, $cellW, $cellH)
      $brush.Dispose()

      if ($null -ne $entry) {
        $text = Format-OneDecimal $entry.Value
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect = New-Object System.Drawing.RectangleF -ArgumentList @([float]$x, [float]$y, [float]$cellW, [float]$cellH)
        $graphics.DrawString($text, $CellFont, $BrushDark, $textRect, $format)
        $format.Dispose()
      }
    }
  }

  $bottomMonthY = $top + $Years.Count * ($cellH + $gap) + 8
  foreach ($month in $Months) {
    $x = $left + ($month - 1) * ($cellW + $gap)
    $graphics.DrawString("$month$MonthSuffix", $LabelFont, $BrushDark, $x + 21, $bottomMonthY)
  }

  Draw-Legend $graphics $Spec $left ($height - 34)
  $outputPath = Join-Path $OutputDir "$($Slug)_$($Spec.Variable)_sign_calendar.png"
  Save-Canvas $bitmap $graphics $outputPath
  return $outputPath
}

$indexLines = @(
  "# Region Sign Calendars",
  "",
  "- Normal basis: fixed 1991-2020 monthly distribution.",
  "- Sign basis: 33.33-66.67 percentile range = 0.",
  "- Temperature cells show monthly departure from normal.",
  "- Precipitation cells show monthly observed precipitation.",
  "- 2026 Apr-Dec is rendered as missing.",
  ""
)

$regionIndex = 1
foreach ($region in $Regions) {
  $slug = Get-Slug $regionIndex $region
  $indexLines += "## $region"
  $indexLines += ""
  foreach ($spec in $Specs) {
    $data = Build-RegionVariableRows $region $spec $Rows
    $path = Draw-SignCalendar $region $slug $spec $data
    $relativeName = Split-Path $path -Leaf
    $indexLines += "![${region} $($spec.Variable)]($relativeName)"
    $indexLines += ""
  }
  $regionIndex += 1
}

Set-Content -Path (Join-Path $OutputDir "region_sign_calendars_index.md") -Value ($indexLines -join "`n") -Encoding UTF8
