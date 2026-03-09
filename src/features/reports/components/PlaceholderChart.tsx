import { useEffect, useRef } from 'react'
import type { Chart, ChartConfiguration } from 'chart.js'

export function PlaceholderChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const abort = { aborted: false }

    void (async () => {
      const { Chart: ChartJs } = await import('chart.js/auto')
      if (abort.aborted) return
      if (!canvasRef.current) return

      const cfg: ChartConfiguration<'bar', number[], string> = {
        type: 'bar',
        data: {
          labels: ['A', 'B', 'C', 'D'],
          datasets: [
            {
              label: 'Sample',
              data: [3, 7, 4, 6]
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true }
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
  }, [])

  return <canvas ref={canvasRef} />
}

