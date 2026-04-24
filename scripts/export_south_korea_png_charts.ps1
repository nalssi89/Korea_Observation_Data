param(
  [string]$InputPath = "data/output/final/south_korea_fixed_1991_2020_comparison.md",
  [string]$OutputDir = "data/output/final/png_charts"
)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$rows = Import-Csv -Path $InputPath
$LastCompleteYear = 2026
$LastCompleteMonth = 3
$rows = $rows | Where-Object {
  ([int]$_.year -lt $LastCompleteYear) -or
  (([int]$_.year -eq $LastCompleteYear) -and ([int]$_.month -le $LastCompleteMonth))
}
$years = $rows | ForEach-Object { [int]$_.year } | Sort-Object -Unique
$months = 1..12
$monthSuffix = [string][char]0xC6D4

$fontFamily = "Malgun Gothic"
$titleFont = New-Object System.Drawing.Font($fontFamily, 18, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font($fontFamily, 10, [System.Drawing.FontStyle]::Regular)
$labelFont = New-Object System.Drawing.Font($fontFamily, 9, [System.Drawing.FontStyle]::Regular)
$smallFont = New-Object System.Drawing.Font($fontFamily, 8, [System.Drawing.FontStyle]::Regular)
$cellFont = New-Object System.Drawing.Font($fontFamily, 7, [System.Drawing.FontStyle]::Bold)

$brushDark = [System.Drawing.Brushes]::Black
$penAxis = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(130, 140, 150), 1)
$penGrid = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226, 222, 210), 1)

$specs = @(
  @{
    Variable = "tavg"; Heading = "Mean Temperature"; Unit = "C"; ValueField = "departure_value"; AnnualMode = "mean";
    Minus = [System.Drawing.Color]::FromArgb(166,206,227); Similar = [System.Drawing.Color]::FromArgb(246,238,202); Plus = [System.Drawing.Color]::FromArgb(244,161,151)
  },
  @{
    Variable = "tmin"; Heading = "Minimum Temperature"; Unit = "C"; ValueField = "departure_value"; AnnualMode = "mean";
    Minus = [System.Drawing.Color]::FromArgb(168,207,232); Similar = [System.Drawing.Color]::FromArgb(246,238,202); Plus = [System.Drawing.Color]::FromArgb(241,170,159)
  },
  @{
    Variable = "tmax"; Heading = "Maximum Temperature"; Unit = "C"; ValueField = "departure_value"; AnnualMode = "mean";
    Minus = [System.Drawing.Color]::FromArgb(173,216,230); Similar = [System.Drawing.Color]::FromArgb(246,238,202); Plus = [System.Drawing.Color]::FromArgb(238,145,135)
  },
  @{
    Variable = "precip"; Heading = "Precipitation"; Unit = "mm"; ValueField = "observed_value"; AnnualMode = "sumDeparture";
    Minus = [System.Drawing.Color]::FromArgb(176,125,60); Similar = [System.Drawing.Color]::FromArgb(236,226,198); Plus = [System.Drawing.Color]::FromArgb(89,154,104)
  }
)
$missingColor = [System.Drawing.Color]::FromArgb(230, 230, 226)

function Get-SignColor($spec, [string]$sign) {
  if ($sign -eq "-") { return $spec.Minus }
  if ($sign -eq "+") { return $spec.Plus }
  if ($sign -eq $null -or $sign -eq "") { return $script:missingColor }
  return $spec.Similar
}

function New-Canvas([int]$width, [int]$height) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(251, 250, 245))
  return @($bitmap, $graphics)
}

function Save-Canvas($bitmap, $graphics, [string]$path) {
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Draw-Legend($g, $spec, [int]$x, [int]$y) {
  $items = @(
    @{ Sign = "-"; Label = $(if ($spec.Variable -eq "precip") { "Dry" } else { "Low" }) },
    @{ Sign = "0"; Label = "Similar" },
    @{ Sign = "+"; Label = $(if ($spec.Variable -eq "precip") { "Wet" } else { "High" }) }
  )
  for ($i = 0; $i -lt $items.Count; $i++) {
    $item = $items[$i]
    $px = $x + $i * 96
    $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $spec $item.Sign))
    $g.FillRectangle($brush, $px, $y, 15, 15)
    $brush.Dispose()
    $g.DrawString("$($item.Sign) $($item.Label)", $labelFont, $brushDark, $px + 21, $y - 1)
  }
}

function Format-OneDecimal([double]$value) {
  return "{0:F1}" -f ([Math]::Round($value, 1))
}

function Get-EnsoPhaseMap {
  $oniText = @'
1970 0.5 0.3 0.3 0.2 0.0 -0.3 -0.6 -0.8 -0.8 -0.7 -0.9 -1.1
1971 -1.4 -1.4 -1.1 -0.8 -0.7 -0.7 -0.8 -0.8 -0.8 -0.9 -1.0 -0.9
1972 -0.7 -0.4 0.1 0.4 0.7 0.9 1.1 1.4 1.6 1.8 2.1 2.1
1973 1.8 1.2 0.5 -0.1 -0.5 -0.9 -1.1 -1.3 -1.5 -1.7 -1.9 -2.0
1974 -1.8 -1.6 -1.2 -1.0 -0.9 -0.8 -0.5 -0.4 -0.4 -0.6 -0.8 -0.6
1975 -0.5 -0.6 -0.7 -0.7 -0.8 -1.0 -1.1 -1.2 -1.4 -1.4 -1.6 -1.7
1976 -1.6 -1.2 -0.7 -0.5 -0.3 0.0 0.2 0.4 0.6 0.8 0.9 0.8
1977 0.7 0.6 0.3 0.2 0.2 0.3 0.4 0.4 0.6 0.7 0.8 0.8
1978 0.7 0.4 0.1 -0.2 -0.3 -0.3 -0.4 -0.4 -0.4 -0.3 -0.1 0.0
1979 0.0 0.1 0.2 0.3 0.2 0.0 0.0 0.2 0.3 0.5 0.5 0.6
1980 0.6 0.5 0.3 0.4 0.5 0.5 0.3 0.0 -0.1 0.0 0.1 0.0
1981 -0.3 -0.5 -0.5 -0.4 -0.3 -0.3 -0.3 -0.2 -0.2 -0.1 -0.2 -0.1
1982 0.0 0.1 0.2 0.5 0.7 0.7 0.8 1.1 1.6 2.0 2.2 2.2
1983 2.2 1.9 1.5 1.3 1.1 0.7 0.3 -0.1 -0.5 -0.8 -1.0 -0.9
1984 -0.6 -0.4 -0.3 -0.4 -0.5 -0.4 -0.3 -0.2 -0.2 -0.6 -0.9 -1.1
1985 -1.0 -0.8 -0.8 -0.8 -0.8 -0.6 -0.5 -0.5 -0.4 -0.3 -0.3 -0.4
1986 -0.5 -0.5 -0.3 -0.2 -0.1 0.0 0.2 0.4 0.7 0.9 1.1 1.2
1987 1.2 1.2 1.1 0.9 1.0 1.2 1.5 1.7 1.6 1.5 1.3 1.1
1988 0.8 0.5 0.1 -0.3 -0.9 -1.3 -1.3 -1.1 -1.2 -1.5 -1.8 -1.8
1989 -1.7 -1.4 -1.1 -0.8 -0.6 -0.4 -0.3 -0.3 -0.2 -0.2 -0.2 -0.1
1990 0.1 0.2 0.3 0.3 0.3 0.3 0.3 0.4 0.4 0.3 0.4 0.4
1991 0.4 0.3 0.2 0.3 0.5 0.6 0.7 0.6 0.6 0.8 1.2 1.5
1992 1.7 1.6 1.5 1.3 1.1 0.7 0.4 0.1 -0.1 -0.2 -0.3 -0.1
1993 0.1 0.3 0.5 0.7 0.7 0.6 0.3 0.3 0.2 0.1 0.0 0.1
1994 0.1 0.1 0.2 0.3 0.4 0.4 0.4 0.4 0.6 0.7 1.0 1.1
1995 1.0 0.7 0.5 0.3 0.1 0.0 -0.2 -0.5 -0.8 -1.0 -1.0 -1.0
1996 -0.9 -0.8 -0.6 -0.4 -0.3 -0.3 -0.3 -0.3 -0.4 -0.4 -0.4 -0.5
1997 -0.5 -0.4 -0.1 0.3 0.8 1.2 1.6 1.9 2.1 2.3 2.4 2.4
1998 2.2 1.9 1.4 1.0 0.5 -0.1 -0.8 -1.1 -1.3 -1.4 -1.5 -1.6
1999 -1.5 -1.3 -1.1 -1.0 -1.0 -1.0 -1.1 -1.1 -1.2 -1.3 -1.5 -1.7
2000 -1.7 -1.4 -1.1 -0.8 -0.7 -0.6 -0.6 -0.5 -0.5 -0.6 -0.7 -0.7
2001 -0.7 -0.5 -0.4 -0.3 -0.3 -0.1 -0.1 -0.1 -0.2 -0.3 -0.3 -0.3
2002 -0.1 0.0 0.1 0.2 0.4 0.7 0.8 0.9 1.0 1.2 1.3 1.1
2003 0.9 0.6 0.4 0.0 -0.3 -0.2 0.1 0.2 0.3 0.3 0.4 0.4
2004 0.4 0.3 0.2 0.2 0.2 0.3 0.5 0.6 0.7 0.7 0.7 0.7
2005 0.6 0.6 0.4 0.4 0.3 0.1 -0.1 -0.1 -0.1 -0.3 -0.6 -0.8
2006 -0.9 -0.8 -0.6 -0.4 -0.1 0.0 0.1 0.3 0.5 0.8 0.9 0.9
2007 0.7 0.2 -0.1 -0.3 -0.4 -0.5 -0.6 -0.8 -1.1 -1.3 -1.5 -1.6
2008 -1.6 -1.5 -1.3 -1.0 -0.8 -0.6 -0.4 -0.2 -0.2 -0.4 -0.6 -0.7
2009 -0.8 -0.8 -0.6 -0.3 0.0 0.3 0.5 0.6 0.7 1.0 1.4 1.6
2010 1.5 1.2 0.8 0.4 -0.2 -0.7 -1.0 -1.3 -1.6 -1.6 -1.6 -1.5
2011 -1.3 -1.0 -0.8 -0.6 -0.5 -0.4 -0.4 -0.6 -0.8 -1.0 -1.0 -0.9
2012 -0.7 -0.6 -0.5 -0.4 -0.2 0.1 0.3 0.4 0.4 0.3 0.1 -0.1
2013 -0.3 -0.3 -0.2 -0.2 -0.3 -0.3 -0.4 -0.3 -0.2 -0.1 -0.1 -0.2
2014 -0.3 -0.3 -0.1 0.2 0.3 0.2 0.1 0.1 0.3 0.5 0.7 0.8
2015 0.7 0.6 0.7 0.8 1.0 1.3 1.6 1.9 2.2 2.5 2.6 2.8
2016 2.6 2.3 1.7 1.0 0.5 0.0 -0.3 -0.5 -0.6 -0.6 -0.6 -0.5
2017 -0.2 0.0 0.2 0.3 0.4 0.4 0.2 -0.1 -0.3 -0.6 -0.8 -0.9
2018 -0.8 -0.7 -0.6 -0.4 -0.1 0.1 0.1 0.3 0.5 0.8 1.0 0.9
2019 0.9 0.9 0.8 0.8 0.6 0.5 0.3 0.2 0.2 0.4 0.6 0.7
2020 0.6 0.6 0.5 0.3 0.0 -0.2 -0.4 -0.5 -0.8 -1.1 -1.2 -1.1
2021 -0.9 -0.8 -0.7 -0.5 -0.4 -0.3 -0.3 -0.4 -0.6 -0.8 -0.9 -0.9
2022 -0.8 -0.8 -0.9 -1.0 -0.9 -0.8 -0.8 -0.9 -1.0 -0.9 -0.8 -0.7
2023 -0.5 -0.3 0.0 0.3 0.6 0.8 1.1 1.4 1.6 1.8 2.0 2.1
2024 1.9 1.6 1.3 0.8 0.5 0.2 0.1 -0.1 -0.2 -0.2 -0.3 -0.4
2025 -0.4 -0.2 -0.1 0.0 0.0 0.0 -0.1 -0.3 -0.4 -0.5 -0.6 -0.5
2026 -0.4 -0.2
'@
  $items = @()
  foreach ($line in $oniText -split "`n") {
    $trimmed = $line.Trim()
    if ($trimmed -eq "") { continue }
    $parts = $trimmed -split "\s+"
    $year = [int]$parts[0]
    for ($index = 1; $index -lt $parts.Count; $index++) {
      $items += @{
        Year = $year
        Month = $index
        Value = [double]$parts[$index]
        RawPhase = $(if ([double]$parts[$index] -ge 0.5) { "El Nino" } elseif ([double]$parts[$index] -le -0.5) { "La Nina" } else { "Neutral" })
      }
    }
  }

  $phaseMap = @{}
  $run = @()
  foreach ($item in $items) {
    if ($item.RawPhase -eq "Neutral") {
      if ($run.Count -ge 5) {
        foreach ($runItem in $run) { $phaseMap["$($runItem.Year):$($runItem.Month)"] = $runItem.RawPhase }
      }
      $run = @()
      continue
    }

    if ($run.Count -gt 0 -and $run[-1].RawPhase -ne $item.RawPhase) {
      if ($run.Count -ge 5) {
        foreach ($runItem in $run) { $phaseMap["$($runItem.Year):$($runItem.Month)"] = $runItem.RawPhase }
      }
      $run = @()
    }
    $run += $item
  }
  if ($run.Count -ge 5) {
    foreach ($runItem in $run) { $phaseMap["$($runItem.Year):$($runItem.Month)"] = $runItem.RawPhase }
  }

  return $phaseMap
}

$ensoPhaseMap = Get-EnsoPhaseMap

function Draw-EnsoLegend($g, [int]$x, [int]$y) {
  $elNinoPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(228, 82, 38), 3)
  $laNinaPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(42, 83, 180), 3)
  $g.DrawRectangle($elNinoPen, $x, $y, 20, 14)
  $g.DrawString("El Nino (ONI)", $labelFont, $brushDark, $x + 28, $y - 1)
  $g.DrawRectangle($laNinaPen, $x + 145, $y, 20, 14)
  $g.DrawString("La Nina (ONI)", $labelFont, $brushDark, $x + 173, $y - 1)
  $elNinoPen.Dispose()
  $laNinaPen.Dispose()
}

function Draw-SignCalendar($spec, $data, [bool]$DrawOni = $false, [string]$FileSuffix = "sign_calendar") {
  $cellW = 68
  $cellH = 18
  $gap = 2
  $left = 92
  $top = 82
  $width = $left + 12 * ($cellW + $gap) + 34
  $height = $top + $years.Count * ($cellH + $gap) + 86
  $canvas = New-Canvas $width $height
  $bitmap = $canvas[0]
  $g = $canvas[1]

  $g.DrawString("$($spec.Heading) Sign Calendar", $titleFont, $brushDark, 24, 18)
  $g.DrawString("1973-2026, middle tercile range = 0", $subtitleFont, [System.Drawing.Brushes]::DimGray, 24, 42)
  if ($DrawOni) {
    $g.DrawString("ENSO boxes: NOAA CPC ONI v5, centered season month, minimum 5 consecutive seasons", $subtitleFont, [System.Drawing.Brushes]::DimGray, 24, 56)
  }

  foreach ($month in $months) {
    $x = $left + ($month - 1) * ($cellW + $gap)
    $g.DrawString("$month$monthSuffix", $smallFont, $brushDark, $x + 21, 66)
  }

  for ($yi = 0; $yi -lt $years.Count; $yi++) {
    $year = $years[$yi]
    $y = $top + $yi * ($cellH + $gap)
    $g.DrawString([string]$year, $smallFont, [System.Drawing.Brushes]::DimGray, 44, $y - 1)
    foreach ($month in $months) {
      $row = $data["$($spec.Variable):${year}:${month}"]
      $x = $left + ($month - 1) * ($cellW + $gap)
      $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $spec $row.departure_sign))
      $g.FillRectangle($brush, $x, $y, $cellW, $cellH)
      $brush.Dispose()
      if ($null -ne $row) {
        $value = [double]($row | Select-Object -ExpandProperty $spec.ValueField)
        $text = Format-OneDecimal $value
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect = New-Object System.Drawing.RectangleF -ArgumentList @([float]$x, [float]$y, [float]$cellW, [float]$cellH)
        $g.DrawString($text, $cellFont, $brushDark, $textRect, $format)
        $format.Dispose()
      }
      if ($DrawOni) {
        $ensoPhase = $ensoPhaseMap["${year}:${month}"]
        if ($ensoPhase -eq "El Nino" -or $ensoPhase -eq "La Nina") {
          $ensoColor = $(if ($ensoPhase -eq "El Nino") { [System.Drawing.Color]::FromArgb(228, 82, 38) } else { [System.Drawing.Color]::FromArgb(42, 83, 180) })
          $ensoPen = New-Object System.Drawing.Pen($ensoColor, 3)
          $g.DrawRectangle($ensoPen, $x + 1, $y + 1, $cellW - 2, $cellH - 2)
          $ensoPen.Dispose()
        }
      }
    }
  }

  $bottomMonthY = $top + $years.Count * ($cellH + $gap) + 8
  foreach ($month in $months) {
    $x = $left + ($month - 1) * ($cellW + $gap)
    $g.DrawString("$month$monthSuffix", $smallFont, $brushDark, $x + 21, $bottomMonthY)
  }

  Draw-Legend $g $spec $left ($height - 34)
  if ($DrawOni) {
    Draw-EnsoLegend $g ($left + 310) ($height - 34)
  }
  Save-Canvas $bitmap $g (Join-Path $OutputDir "$($spec.Variable)_$FileSuffix.png")
}

function Draw-AnnualRibbon($spec, $data) {
  $width = 980
  $height = 300
  $left = 70
  $right = 32
  $top = 62
  $bottom = 52
  $chartW = $width - $left - $right
  $chartH = $height - $top - $bottom
  $zeroY = $top + $chartH / 2
  $values = @()
  foreach ($year in $years) {
    $yearRows = foreach ($month in $months) { $data["$($spec.Variable):${year}:${month}"] }
    $yearRows = @($yearRows | Where-Object { $null -ne $_ })
    if ($yearRows.Count -lt 12) {
      continue
    }
    if ($spec.AnnualMode -eq "sumDeparture") {
      $value = ($yearRows | Measure-Object -Property departure_value -Sum).Sum
    } else {
      $value = ($yearRows | Measure-Object -Property departure_value -Average).Average
    }
    $values += @{ Year = $year; Value = [double]$value }
  }
  $barW = $chartW / $values.Count

  $maxAbs = ($values | ForEach-Object { [Math]::Abs($_.Value) } | Measure-Object -Maximum).Maximum
  if ($maxAbs -le 0) { $maxAbs = 1 }

  $canvas = New-Canvas $width $height
  $bitmap = $canvas[0]
  $g = $canvas[1]
  $label = $(if ($spec.AnnualMode -eq "sumDeparture") { "Annual Precip Departure Sum" } else { "Annual Mean Monthly Departure" })
  $g.DrawString("$($spec.Heading) $label", $titleFont, $brushDark, 24, 18)
  $g.DrawLine($penAxis, $left, $zeroY, $width - $right, $zeroY)

  for ($i = 0; $i -lt $values.Count; $i++) {
    $entry = $values[$i]
    $barH = [Math]::Abs($entry.Value) / $maxAbs * ($chartH / 2)
    $x = $left + $i * $barW
    $y = $(if ($entry.Value -ge 0) { $zeroY - $barH } else { $zeroY })
    $sign = $(if ($entry.Value -gt 0) { "+" } elseif ($entry.Value -lt 0) { "-" } else { "0" })
    $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $spec $sign))
    $g.FillRectangle($brush, [float]$x, [float]$y, [float]([Math]::Max(2, $barW - 1)), [float]$barH)
    $brush.Dispose()
  }

  $valueYears = @($values | ForEach-Object { [int]$_.Year })
  foreach ($year in $valueYears) {
    if ($year -eq $valueYears[0] -or $year % 10 -eq 0 -or $year -eq $valueYears[-1]) {
      $x = $left + ([Array]::IndexOf($valueYears, $year)) * $barW
      $g.DrawString([string]$year, $smallFont, [System.Drawing.Brushes]::DimGray, [float]($x - 10), $height - 30)
    }
  }
  $g.DrawString("+$(Format-OneDecimal $maxAbs)", $smallFont, [System.Drawing.Brushes]::DimGray, 18, $top - 4)
  $g.DrawString("-$(Format-OneDecimal $maxAbs)", $smallFont, [System.Drawing.Brushes]::DimGray, 18, $top + $chartH - 8)

  Save-Canvas $bitmap $g (Join-Path $OutputDir "$($spec.Variable)_annual_ribbon.png")
}

function Draw-MonthlyDistribution($spec, $data) {
  $width = 980
  $height = 300
  $left = 70
  $top = 70
  $barW = 52
  $barH = 140
  $gap = 22
  $canvas = New-Canvas $width $height
  $bitmap = $canvas[0]
  $g = $canvas[1]

  $g.DrawString("$($spec.Heading) Monthly Sign Distribution", $titleFont, $brushDark, 24, 18)
  $g.DrawString("Numbers above bars are +/0/- counts", $subtitleFont, [System.Drawing.Brushes]::DimGray, 24, 42)

  foreach ($month in $months) {
    $monthRows = foreach ($year in $years) { $data["$($spec.Variable):${year}:${month}"] }
    $monthRows = @($monthRows | Where-Object { $null -ne $_ })
    $plus = @($monthRows | Where-Object { $_.departure_sign -eq "+" }).Count
    $similar = @($monthRows | Where-Object { $_.departure_sign -eq "0" }).Count
    $minus = @($monthRows | Where-Object { $_.departure_sign -eq "-" }).Count
    $total = [Math]::Max(1, $plus + $similar + $minus)
    $x = $left + ($month - 1) * ($barW + $gap)
    $y = $top + $barH
    foreach ($part in @(
      @{ Sign = "-"; Count = $minus },
      @{ Sign = "0"; Count = $similar },
      @{ Sign = "+"; Count = $plus }
    )) {
      $h = $part.Count / $total * $barH
      $y -= $h
      $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $spec $part.Sign))
      $g.FillRectangle($brush, [float]$x, [float]$y, $barW, [float]$h)
      $brush.Dispose()
    }
    $g.DrawRectangle($penGrid, $x, $top, $barW, $barH)
    $g.DrawString("$plus/$similar/$minus", $smallFont, [System.Drawing.Brushes]::DimGray, $x + 5, $top - 18)
    $g.DrawString("$month$monthSuffix", $labelFont, $brushDark, $x + 10, $top + $barH + 12)
  }
  Draw-Legend $g $spec 650 260

  Save-Canvas $bitmap $g (Join-Path $OutputDir "$($spec.Variable)_monthly_distribution.png")
}

function Draw-RecentMatrix($spec, $data) {
  $recentYears = $years | Select-Object -Last 10
  $cellW = 66
  $cellH = 34
  $left = 76
  $top = 68
  $width = $left + 12 * $cellW + 34
  $height = $top + $recentYears.Count * $cellH + 56
  $canvas = New-Canvas $width $height
  $bitmap = $canvas[0]
  $g = $canvas[1]

  $g.DrawString("$($spec.Heading) Recent 10-Year Detail", $titleFont, $brushDark, 24, 18)
  $g.DrawString("Cell text: value and sign", $subtitleFont, [System.Drawing.Brushes]::DimGray, 24, 42)
  foreach ($month in $months) {
    $x = $left + ($month - 1) * $cellW
    $g.DrawString("$month$monthSuffix", $smallFont, $brushDark, $x + 18, 52)
  }

  for ($yi = 0; $yi -lt $recentYears.Count; $yi++) {
    $year = [int]$recentYears[$yi]
    $y = $top + $yi * $cellH
    $g.DrawString([string]$year, $labelFont, $brushDark, 34, $y + 8)
    foreach ($month in $months) {
      $row = $data["$($spec.Variable):${year}:${month}"]
      $x = $left + ($month - 1) * $cellW
      $brush = New-Object System.Drawing.SolidBrush((Get-SignColor $spec $row.departure_sign))
      $rect = New-Object System.Drawing.Rectangle -ArgumentList @(
        [int]($x + 2),
        [int]($y + 3),
        [int]($cellW - 5),
        [int]($cellH - 6)
      )
      $g.FillRectangle($brush, $rect)
      $brush.Dispose()
      if ($null -ne $row) {
        $value = [double]($row | Select-Object -ExpandProperty $spec.ValueField)
        $text = "$(Format-OneDecimal $value)$($row.departure_sign)"
        $format = New-Object System.Drawing.StringFormat
        $format.Alignment = [System.Drawing.StringAlignment]::Center
        $format.LineAlignment = [System.Drawing.StringAlignment]::Center
        $textRect = New-Object System.Drawing.RectangleF -ArgumentList @(
          [float]$rect.X,
          [float]$rect.Y,
          [float]$rect.Width,
          [float]$rect.Height
        )
        $g.DrawString($text, $cellFont, $brushDark, $textRect, $format)
        $format.Dispose()
      }
    }
  }

  Save-Canvas $bitmap $g (Join-Path $OutputDir "$($spec.Variable)_recent_10yr_matrix.png")
}

$data = @{}
foreach ($row in $rows) {
  $key = "$($row.variable):$($row.year):$($row.month)"
  $data[$key] = $row
}

foreach ($spec in $specs) {
  Draw-SignCalendar $spec $data
  Draw-SignCalendar $spec $data $true "oni_sign_calendar"
  Draw-AnnualRibbon $spec $data
  Draw-MonthlyDistribution $spec $data
  Draw-RecentMatrix $spec $data
}

$indexLines = @(
  "# South Korea Variable PNG Charts",
  "",
  "- Station basis: South Korea mainland, 56 stations for 1973-1989 and 62 stations for 1990 onward.",
  "- Sign basis: 0 means the 33.33-66.67 percentile range for each calendar month in 1991-2020.",
  ""
)
foreach ($spec in $specs) {
  $indexLines += "## $($spec.Heading)"
  $indexLines += ""
  $indexLines += "![Sign calendar]($($spec.Variable)_sign_calendar.png)"
  $indexLines += ""
  $indexLines += "![ONI sign calendar]($($spec.Variable)_oni_sign_calendar.png)"
  $indexLines += ""
  $indexLines += "![Annual ribbon]($($spec.Variable)_annual_ribbon.png)"
  $indexLines += ""
  $indexLines += "![Monthly sign distribution]($($spec.Variable)_monthly_distribution.png)"
  $indexLines += ""
  $indexLines += "![Recent 10-year detail]($($spec.Variable)_recent_10yr_matrix.png)"
  $indexLines += ""
}

Set-Content -Path (Join-Path $OutputDir "png_charts_index.md") -Value ($indexLines -join "`n") -Encoding UTF8
