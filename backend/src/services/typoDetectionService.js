
const commonDomains = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
    "live.com",
    "msn.com",
];

const levenshteinDistance = (a, b) => {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                );
            }
        }
    }

    return matrix[b.length][a.length];
};

export const getDidYouMean = (email) => {
    if (!email || !email.includes("@")) {
        return null;
    }

    const [localPart, domain] = email.split("@");

    if (!domain) return null;

    if (commonDomains.includes(domain.toLowerCase())) {
        return null;
    }

    let closestDomain = null;
    let minDistance = Infinity;

    const threshold = 2;

    for (const commonDomain of commonDomains) {
        const distance = levenshteinDistance(domain.toLowerCase(), commonDomain);

        if (distance <= threshold && distance < minDistance) {
            minDistance = distance;
            closestDomain = commonDomain;
        }
    }

    if (closestDomain) {
        return `${localPart}@${closestDomain}`;
    }

    return null;
};
