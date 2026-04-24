param(
  [string]$InputPath = "data/output/final/south_korea_fixed_1991_2020_comparison.md",
  [string]$OutputDir = "data/output/final/png_charts"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$LastCompleteYear = 2026
$LastCompleteMonth = 3
$rows = Import-Csv -Path $InputPath | Where-Object {
  ([int]$_.year -lt $LastCompleteYear) -or
  (([int]$_.year -eq $LastCompleteYear) -and ([int]$_.month -le $LastCompleteMonth))
}
$years = $rows | ForEach-Object { [int]$_.year } | Sort-Object -Unique
$months = 1..12
$monthSuffix = [string][char]0xC6D4

$fontFamily = "Malgun Gothic"
$titleFont = New-Object System.Drawing.Font($fontFamily, 22, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font($fontFamily, 10, [System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font($fontFamily, 9, [System.Drawing.FontStyle]::Regular)
$smallFont = New-Object System.Drawing.Font($fontFamily, 8, [System.Drawing.FontStyle]::Regular)

$brushDark = [System.Drawing.Brushes]::Black
$missingColor = [System.Drawing.Color]::FromArgb(226, 226, 220)

$specs = @(
  @{
    Variable = "tavg"; Heading = "Mean Temperature"; Unit = "C"; ValueField = "departure_value"; HeightField = "departure_value"; HeightMode = "abs";
    Minus = [System.Drawing.Color]::FromArgb(142, 198, 224); Similar = [System.Drawing.Color]::FromArgb(238, 230, 195); Plus = [System.Drawing.Color]::FromArgb(241, 142, 132)
  },
  @{
    Variable = "tmin"; Heading = "Minimum Temperature"; Unit = "C"; ValueField = "departure_value"; HeightField = "departure_value"; HeightMode = "abs";
    Minus = [System.Drawing.Color]::FromArgb(132, 190, 224); Similar = [System.Drawing.Color]::FromArgb(238, 230, 195); Plus = [System.Drawing.Color]::FromArgb(234, 155, 145)
  },
  @{
    Variable = "tmax"; Heading = "Maximum Temperature"; Unit = "C"; ValueField = "departure_value"; HeightField = "departure_value"; HeightMode = "abs";
    Minus = [System.Drawing.Color]::FromArgb(154, 210, 228); Similar = [System.Drawing.Color]::FromArgb(238, 230, 195); Plus = [System.Drawing.Color]::FromArgb(234, 128, 118)
  },
  @{
    Variable = "precip"; Heading = "Precipitation"; Unit = "mm"; ValueField = "observed_value"; HeightField = "observed_value"; HeightMode = "sqrt";
    Minus = [System.Drawing.Color]::FromArgb(174, 120, 54); Similar = [System.Drawing.Color]::FromArgb(232, 221, 190); Plus = [System.Drawing.Color]::FromArgb(78, 154, 94)
  }
)

function New-Canvas([int]$width, [int]$height) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(250, 248, 239))
  return @($bitmap, $graphics)
}

function Save-Canvas($bitmap, $graphics, [string]$path) {
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Clamp([int]$value) {
  return [Math]::Max(0, [Math]::Min(255, $value))
}

function Adjust-Color([System.Drawing.Color]$color, [int]$delta) {
  return [System.Drawing.Color]::FromArgb(
    (Clamp ($color.R + $delta)),
    (Clamp ($color.G + $delta)),
    (Clamp ($color.B + $delta))
  )
}

function Get-SignColor($spec, [string]$sign) {
  if ($sign -eq "-") { return $spec.Minus }
  if ($sign -eq "+") { return $spec.Plus }
  if ($sign -eq "0") { return $spec.Similar }
  return $missingColor
}

function Draw-Block($g, [int]$x, [int]$y, [int]$w, [int]$h, [int]$depth, [int]$lift, [System.Drawing.Color]$color, [string]$label) {
  $topY = $y - $lift
  $frontBrush = New-Object System.Drawing.SolidBrush($color)
  $topBrush = New-Object System.Drawing.SolidBrush((Adjust-Color $color 35))
  $sideBrush = New-Object System.Drawing.SolidBrush((Adjust-Color $color -32))
  $edgePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 245, 240), 1)

  $topPoly = New-Object System.Drawing.Point[] 4
  $topPoly[0] = New-Object System.Drawing.Point -ArgumentList @($x, $topY)
  $topPoly[1] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $depth)), ([int]($topY - $depth)))
  $topPoly[2] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $w + $depth)), ([int]($topY - $depth)))
  $topPoly[3] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $w)), $topY)

  $sidePoly = New-Object System.Drawing.Point[] 4
  $sidePoly[0] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $w)), $topY)
  $sidePoly[1] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $w + $depth)), ([int]($topY - $depth)))
  $sidePoly[2] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $w + $depth)), ([int]($topY - $depth + $h)))
  $sidePoly[3] = New-Object System.Drawing.Point -ArgumentList @(([int]($x + $w)), ([int]($topY + $h)))
  $frontRect = New-Object System.Drawing.Rectangle -ArgumentList @($x, $topY, $w, $h)

  $g.FillPolygon($topBrush, $topPoly)
  $g.FillPolygon($sideBrush, $sidePoly)
  $g.FillRectangle($frontBrush, $frontRect)
  $g.DrawPolygon($edgePen, $topPoly)
  $g.DrawPolygon($edgePen, $sidePoly)
  $g.DrawRectangle($edgePen, $frontRect)

  if ($label -ne "") {
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $labelFont = New-Object System.Drawing.Font("Malgun Gothic", 6.5, [System.Drawing.FontStyle]::Bold)
    $textRect = New-Object System.Drawing.RectangleF -ArgumentList @([float]$x, [float]$topY, [float]$w, [float]$h)
    $g.DrawString($label, $labelFont, [System.Drawing.Brushes]::Black, $textRect, $format)
    $labelFont.Dispose()
    $format.Dispose()
  }

  $frontBrush.Dispose()
  $topBrush.Dispose()
  $sideBrush.Dispose()
  $edgePen.Dispose()
}

function Draw-Legend($g, $spec, [int]$x, [int]$y) {
  $items = @(
    @{ Sign = "-"; Label = $(if ($spec.Variable -eq "precip") { "Dry" } else { "Low" }) },
    @{ Sign = "0"; Label = "Similar" },
    @{ Sign = "+"; Label = $(if ($spec.Variable -eq "precip") { "Wet" } else { "High" }) },
    @{ Sign = ""; Label = "Missing" }
  )
  for ($i = 0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $px = $x + $i * 110
    Draw-Block $g $px $y 18 13 5 4 (Get-SignColor $spec $item.Sign) ""
    $g.DrawString("$($item.Sign) $($item.Label)", $labelFont, $brushDark, $px + 30, $y - 5)
  }
}

function Get-MaxHeightValue($spec, $data) {
  $values = @()
  foreach ($row in $data.Values) {
    $raw = [double]($row | Select-Object -ExpandProperty $spec.HeightField)
    if ($spec.HeightMode -eq "abs") {
      $values += [Math]::Abs($raw)
    } elseif ($spec.HeightMode -eq "sqrt") {
      $values += [Math]::Sqrt([Math]::Max(0, $raw))
    } else {
      $values += $raw
    }
  }
  $maxValue = ($values | Measure-Object -Maximum).Maximum
  if ($maxValue -le 0) { return 1 }
  return $maxValue
}

function Draw-TerrainCalendar($spec, $data) {
  $cellW = 61
  $cellH = 17
  $gapX = 2
  $gapY = 3
  $depth = 8
  $maxLift = 22
  $left = 96
  $top = 100
  $width = $left + 12 * ($cellW + $gapX) + 70
  $height = $top + $years.Count * ($cellH + $gapY) + 88
  $maxHeightValue = Get-MaxHeightValue $spec $data

  $canvas = New-Canvas $width $height
  $bitmap = $canvas[0]
  $g = $canvas[1]

  $g.DrawString("$($spec.Heading) 3D Terrain Calendar", $titleFont, $brushDark, 24, 18)
  $g.DrawString("Height = value magnitude, color = tercile sign, 2026 Apr-Dec = missing", $subtitleFont, [System.Drawing.Brushes]::DimGray, 26, 48)

  foreach ($month in $months) {
    $x = $left + ($month - 1) * ($cellW + $gapX)
    $g.DrawString("$month$monthSuffix", $smallFont, $brushDark, $x + 20, 78)
  }

  for ($yi = 0; $yi -lt $years.Count; $yi++) {
    $year = [int]$years[$yi]
    $y = $top + $yi * ($cellH + $gapY)
    if ($year -eq $years[0] -or $year % 5 -eq 0 -or $year -eq $years[-1]) {
      $g.DrawString([string]$year, $smallFont, [System.Drawing.Brushes]::DimGray, 42, $y - 1)
    }

    foreach ($month in $months) {
      $row = $data["$($spec.Variable):${year}:${month}"]
      $x = $left + ($month - 1) * ($cellW + $gapX)
      $color = Get-SignColor $spec $row.departure_sign
      $label = ""
      $lift = 0
      if ($null -ne $row) {
        $raw = [double]($row | Select-Object -ExpandProperty $spec.HeightField)
        $heightValue = $(if ($spec.HeightMode -eq "abs") { [Math]::Abs($raw) } elseif ($spec.HeightMode -eq "sqrt") { [Math]::Sqrt([Math]::Max(0, $raw)) } else { $raw })
        $lift = [int][Math]::Round(($heightValue / $maxHeightValue) * $maxLift)
        $value = [double]($row | Select-Object -ExpandProperty $spec.ValueField)
        $label = [string]([Math]::Round($value, 1))
      }
      Draw-Block $g $x $y $cellW $cellH $depth $lift $color $label
    }
  }

  Draw-Legend $g $spec $left ($height - 42)
  Save-Canvas $bitmap $g (Join-Path $OutputDir "$($spec.Variable)_terrain_calendar.png")
}

$dataByVariable = @{}
foreach ($spec in $specs) {
  $dataByVariable[$spec.Variable] = @{}
}
foreach ($row in $rows) {
  $key = "$($row.variable):$($row.year):$($row.month)"
  $dataByVariable[$row.variable][$key] = $row
}

foreach ($spec in $specs) {
  Draw-TerrainCalendar $spec $dataByVariable[$spec.Variable]
}

$indexPath = Join-Path $OutputDir "terrain_calendars_index.md"
$indexLines = @(
  "# 3D Terrain Calendars",
  "",
  "- Height expresses magnitude; color expresses tercile sign.",
  "- Temperature uses monthly departure magnitude.",
  "- Precipitation uses monthly precipitation magnitude.",
  "- 2026 Apr-Dec is rendered as missing.",
  ""
)
foreach ($spec in $specs) {
  $indexLines += "## $($spec.Heading)"
  $indexLines += ""
  $indexLines += "![3D terrain calendar]($($spec.Variable)_terrain_calendar.png)"
  $indexLines += ""
}
Set-Content -Path $indexPath -Value ($indexLines -join "`n") -Encoding UTF8
