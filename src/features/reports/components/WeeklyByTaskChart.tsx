import { useEffect, useRef } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'
import type { WeeklyReportTaskItem } from '@shared/models'

interface WeeklyByTaskChartProps {
  tasks: WeeklyReportTaskItem[]
  onSegmentClick?: (index: number) => void
}

export function WeeklyByTaskChart({ tasks, onSegmentClick }: WeeklyByTaskChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const abort = { aborted: false }

    void (async () => {
      const { Chart: ChartJs } = await import('chart.js/auto')
      if (abort.aborted) return
      if (!canvasRef.current) return

      const top = tasks.slice(0, 6)
      const labels = top.map((t) => t.taskTitle)
      const data = top.map((t) => t.totalSeconds / 3600)

      const cfg: ChartConfiguration<'doughnut', number[], string> = {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              label: 'Saat',
              data
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
            legend: { display: true, position: 'bottom' }
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
  }, [tasks, onSegmentClick])

  return <canvas ref={canvasRef} />
}

