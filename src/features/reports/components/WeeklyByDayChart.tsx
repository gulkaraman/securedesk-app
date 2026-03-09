import { useEffect, useRef } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'
import type { WeeklyReportDayItem } from '@shared/models'
import { formatDateLabel } from '@lib/time'

interface WeeklyByDayChartProps {
  days: WeeklyReportDayItem[]
  onSegmentClick?: (index: number) => void
}

export function WeeklyByDayChart({ days, onSegmentClick }: WeeklyByDayChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const abort = { aborted: false }

    void (async () => {
      const { Chart: ChartJs } = await import('chart.js/auto')
      if (abort.aborted) return
      if (!canvasRef.current) return

      const labels = days.map((d) => formatDateLabel(d.date))
      const data = days.map((d) => d.totalSeconds / 3600)

      const cfg: ChartConfiguration<'bar', number[], string> = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Saat',
              data,
              backgroundColor: 'rgba(124, 92, 255, 0.6)'
            }
          ]
        },
        options: {
          responsive: true,
          onClick: (_, elements) => {
            const first = elements[0]
            if (first != null && onSegmentClick) {
              onSegmentClick(first.index)
            }
          },
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              title: { display: true, text: 'Saat' },
              beginAtZero: true
            }
          }
        }
      }

      chartRef.current = new ChartJs(canvasRef.current, cfg)
    })()

    return () => {
      abort.aborted = true
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [days, onSegmentClick])

  return <canvas ref={canvasRef} />
}

