import { useEffect, useRef } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'
import type { TodayTaskSummaryItem } from '@shared/models'

interface TodaySummaryChartProps {
  summary: TodayTaskSummaryItem[]
  onSegmentClick?: (index: number) => void
}

export function TodaySummaryChart({ summary, onSegmentClick }: TodaySummaryChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const abort = { aborted: false }
    void (async () => {
      const { Chart: ChartJs } = await import('chart.js/auto')
      if (abort.aborted) return
      if (!canvasRef.current) return
      const labels = summary.map((t) => t.taskTitle)
      const data = summary.map((t) => t.totalSeconds / 60)
      const cfg: ChartConfiguration<'bar', number[], string> = {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Dakika',
              data,
              backgroundColor: 'rgba(124, 92, 255, 0.6)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (_, elements) => {
            const first = elements[0]
            if (first != null && onSegmentClick) {
              onSegmentClick(first.index)
            }
          },
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Dakika' } }
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
  }, [summary, onSegmentClick])

  return <canvas ref={canvasRef} />
}
