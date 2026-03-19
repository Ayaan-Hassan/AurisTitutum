
export const calculateConsistency = (logs, days) => {
    const today = new Date();
    let count = 0;
    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        if (logs.some(l => l.date === dateKey && (parseFloat(l.count) || 0) > 0)) {
            count++;
        }
    }
    return (count / days) * 100;
};

export const findMostProductiveDay = (logs) => {
    const dayCounts = Array(7).fill(0);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    logs.forEach(log => {
        const date = new Date(log.date);
        const day = date.getDay();
        dayCounts[day] += (parseFloat(log.count) || 0);
    });

    let maxIdx = 0;
    for (let i = 1; i < 7; i++) {
        if (dayCounts[i] > dayCounts[maxIdx]) maxIdx = i;
    }

    return dayCounts[maxIdx] > 0 ? dayNames[maxIdx] : 'N/A';
};

export const calculateHabitStrength = (logs) => {
    const thirtyDayConsistency = calculateConsistency(logs, 30);
    const sevenDayConsistency = calculateConsistency(logs, 7);
    
    // Weighted average: recent performance matters more
    return Math.round((thirtyDayConsistency * 0.4) + (sevenDayConsistency * 0.6));
};

export const calculateCorrelation = (habitA, habitB, days = 30) => {
    const today = new Date();
    const dataA = [];
    const dataB = [];

    for (let i = 0; i < days; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];

        const logA = habitA.logs?.find(l => l.date === dateKey);
        const logB = habitB.logs?.find(l => l.date === dateKey);

        dataA.push(parseFloat(logA?.count) || 0);
        dataB.push(parseFloat(logB?.count) || 0);
    }

    // Pearson Correlation
    const n = dataA.length;
    const sumA = dataA.reduce((a, b) => a + b, 0);
    const sumB = dataB.reduce((a, b) => a + b, 0);
    const sumAB = dataA.reduce((sum, a, i) => sum + a * dataB[i], 0);
    const sumA2 = dataA.reduce((sum, a) => sum + a * a, 0);
    const sumB2 = dataB.reduce((sum, b) => sum + b * b, 0);

    const numerator = n * sumAB - sumA * sumB;
    const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB));

    if (denominator === 0) return 0;
    const correlation = numerator / denominator;

    // Linear Regression for "on average" insight
    // y = mx + c => m = (n*sumAB - sumA*sumB) / (n*sumA2 - sumA*sumA)
    const mNumerator = n * sumAB - sumA * sumB;
    const mDenominator = n * sumA2 - sumA * sumA;
    const slope = mDenominator !== 0 ? mNumerator / mDenominator : 0;

    return { correlation, slope };
};

export const generateCorrelationInsights = (habits, days = 30) => {
    const insights = [];
    for (let i = 0; i < habits.length; i++) {
        for (let j = i + 1; j < habits.length; j++) {
            const h1 = habits[i];
            const h2 = habits[j];
            const { correlation, slope } = calculateCorrelation(h1, h2, days);

            if (Math.abs(correlation) >= 0.5) { // Threshold for "strong" correlations

                const direction = correlation > 0 ? "increases" : "decreases";
                const strength = Math.abs(correlation) > 0.7 ? "strongly " : "";
                
                // Only generate insight if there's a significant change
                if (Math.abs(slope) > 0.1) {
                    insights.push({
                        habit1: h1.name,
                        habit2: h2.name,
                        correlation,
                        text: `On days you do ${h1.name}, ${h2.name} ${strength}${direction} by ${Math.abs(slope).toFixed(1)} ${h2.unit || 'units'} on average.`
                    });
                }
            }
        }
    }
    return insights.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 5);
};
