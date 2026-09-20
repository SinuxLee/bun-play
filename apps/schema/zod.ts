import * as z from "zod"; 
 
const Player = z.object({
  username: z.string(),
  xp: z.number().min(0).max(10000),
});

let validateResult = Player.validate({ username: "billie", xp: 100 });
console.log(validateResult);
validateResult = Player.validate({ username: 42, xp: "100" });     // false
console.log(validateResult);

const result = Player.safeParse({ username: 42, xp: "100" });
if (!result.success) {
  console.error(result.error);
} else {
  console.log(result.data);
}

// extract the inferred type
type Player = z.infer<typeof Player>;
 
// use it in your code
const player: Player = { username: "billie", xp: 100 };
console.log(player);
