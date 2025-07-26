"use client";

import yaml from 'js-yaml';
import styles from '@/styles/Analysis.module.css'; // 我们将在这里添加新样式
import { Filter, Sigma, CornerDownRight, Settings } from 'lucide-react'; // 导入一些图标

interface Step {
  type: string;
  target: string;
  params?: Record<string, unknown>;
}

interface PreprocessingStepsProps {
  stepsString: string;
}

// 辅助函数，为不同步骤类型选择一个图标
const getStepIcon = (type: string) => {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('filter')) {
    return <Filter size={18} className={styles.stepIcon} />;
  }
  if (typeLower.includes('normalize')) {
    return <Sigma size={18} className={styles.stepIcon} />;
  }
  if (typeLower.includes('feature')) {
    return <CornerDownRight size={18} className={styles.stepIcon} />;
  }
  return <Settings size={18} className={styles.stepIcon} />;
};

export default function PreprocessingSteps({ stepsString }: PreprocessingStepsProps) {
  let steps: Step[] = [];

  try {
    // 使用 js-yaml 解析字符串。loadAll 会处理由 '---' 分隔的多个文档
    const parsed = yaml.loadAll(stepsString.replace(/- type:/g, '\n- type:')); // 确保每个 - 都在新行
    console.log(parsed)
    // 检查解析结果是否是期望的数组格式
    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
      steps = parsed[0] as Step[];
    } else {
      // 尝试作为单个 YAML 文档解析
      const singleParsed = yaml.load(stepsString);
      if(Array.isArray(singleParsed)){
        steps = singleParsed as Step[];
      }
    }
  } catch (e) {
    console.log("Failed to parse preprocessing steps YAML:", e);
    // 如果解析失败，优雅地降级为显示原始文本
    return <pre className={styles.rawText}>{stepsString}</pre>;
  }
  
  if (steps.length === 0) {
      return <pre className={styles.rawText}>{stepsString}</pre>;
  }

  return (
    <div className={styles.stepsContainer}>
      {steps.map((step, index) => (
        <div key={index} className={styles.stepItem}>
          <div className={styles.stepHeader}>
            {getStepIcon(step.type)}
            <span className={styles.stepTitle}>{step.type}: {step.target}</span>
          </div>
          {step.params && Object.keys(step.params).length > 0 && (
            <div className={styles.stepParams}>
              {Object.entries(step.params).map(([key, value]) => (
                <div key={key} className={styles.param}>
                  <span className={styles.paramKey}>{key}:</span>
                  {/* 如果参数值是对象，则格式化为 JSON 字符串 */}
                  <span className={styles.paramValue}>
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}