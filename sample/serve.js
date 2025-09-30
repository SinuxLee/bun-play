const env = process.env
export default{
    port: env.PORT,
    fetch(req){
        return new Response("Upgrade failed");
    }
}

