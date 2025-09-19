const operators = new Map<string, number>([
    ['(', 0],
    [')', 0],
    ['+', 1],
    ['-', 1],
    ['*', 2],
    ['/', 2],
    ['%', 2],
    ['^', 3]
]);

function parseToken(content: string): string[] {
    let p = 0;
    let cur = 0;
    const tokens: string[] = [];

    for (const char of content) {
        if (char >= '0' && char <= '9') {
            p++
            continue
        }

        if (cur !== p) {
            tokens.push(content.substring(cur, p));
        }

        if (operators.has(char)) {
            tokens.push(char);
        } else if (char.trim() !== '') {
            throw new Error(`Invalid character: ${char}`);
        }

        p++
        cur = p
    }

    // last token
    if (cur !== p) {
        tokens.push(content.substring(cur, p));
    }

    return tokens;
}

// 中缀表达式转为逆波兰表达式
function toRPN(tokens: string[]): string[] {
    const stack: string[] = [];
    const exp: string[] = [];

    for (const token of tokens) {
        // 如果是数字，直接加入结果
        if (!isNaN(Number(token))) {
            exp.push(token);
            continue;
        }

        // 如果是左括号，直接入栈
        if (token === '(') {
            stack.push(token);
            continue;
        }

        // 如果是右括号，弹出栈中元素直到遇到左括号
        if (token === ')') {
            while (stack.length > 0 && stack.at(-1) !== '(') {
                exp.push(stack.pop()!);
            }
            // 弹出左括号
            if (stack.length > 0) {
                stack.pop();
            }
            continue;
        }

        // 如果是运算符
        if (operators.has(token)) {
            const tokenPriority = operators.get(token)!;

            // 当栈不为空，且栈顶不是左括号，且当前运算符优先级小于等于栈顶运算符优先级时
            while (stack.length > 0 &&
                stack.at(-1) !== '(' &&
                tokenPriority <= (operators.get(stack.at(-1)!) || 0)) {
                exp.push(stack.pop()!);
            }

            stack.push(token);
        }
    }

    // 将栈中剩余元素弹出
    while (stack.length > 0) {
        exp.push(stack.pop()!);
    }

    return exp;
}

// 计算逆波兰表达式
function evaluateRPN(rpnTokens: string[]): number {
    const stack: number[] = [];

    for (const token of rpnTokens) {
        if (!isNaN(Number(token))) {
            // 如果是数字，压入栈
            stack.push(Number(token));
            continue;
        }

        if (!operators.has(token)) {
            continue
        }


        // 如果是运算符，从栈中弹出操作数进行计算
        if (stack.length < 2) {
            throw new Error("Invalid expression: not enough operands");
        }

        const b = stack.pop()!;
        const a = stack.pop()!;
        let result: number;

        switch (token) {
            case '+':
                result = a + b;
                break;
            case '-':
                result = a - b;
                break;
            case '*':
                result = a * b;
                break;
            case '/':
                if (b === 0) {
                    throw new Error("Division by zero");
                }
                result = a / b;
                break;
            case '%':
                if (b === 0) {
                    throw new Error("Modulo by zero");
                }
                result = a % b;
                break;
            case '^':
                result = Math.pow(a, b);
                break;
            default:
                throw new Error(`Unknown operator: ${token}`);
        }

        stack.push(result);
    }

    if (stack.length !== 1) {
        throw new Error("Invalid expression: too many operands");
    }

    return stack[0]!;
}

export function calc(content: string): string {
    try {
        const tokens = parseToken(content.replace(/\s+/g, ''));
        if (tokens.length === 0) {
            return "0";
        }

        const rpnTokens = toRPN(tokens);
        const result = evaluateRPN(rpnTokens);

        return result.toString();
    } catch (error) {
        return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}

async function main() {
    // 测试用例
    console.log("测试计算器功能:");
    console.log("(2*(3-4))*5 =", calc("(2*(3-4))*5"));
    console.log("2+3*4 =", calc("2+3*4"));
    console.log("(2+3)*4 =", calc("(2+3)*4"));
    console.log("2^3+1 =", calc("2^3+1"));
    console.log("10/2+3*4 =", calc("10/2+3*4"));
    console.log("(11 + 112) * 223 - 3334 / 44445 =", calc("(11 + 112) * 223 - 3334 / 44445"));
    console.log("1/0 =", calc("1/0")); // 测试除零错误
    console.log();

    const prompt = ">";
    const allowedChars = /^[0-9+\-*/\s()^%]+$/
    process.stdout.write(prompt);
    for await (const line of console) {
        if (line === "exit") {
            break;
        }

        if (allowedChars.test(line.trim()) === false) {
            console.log("Invalid characters. Only numbers and + - * / are allowed.");
            process.stdout.write(prompt);
            continue;
        }

        console.log(calc(line));
        process.stdout.write(prompt);
    }
}

if (import.meta.main) {
    main();
}

export const __test__ = {
    parseToken,
    toRPN,
    evaluateRPN,
    calc,
};
