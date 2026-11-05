package com.crmcelulares.app;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.LinkedHashMap;
import java.util.Map;

/** Test-only adapter: the Firestore emulator harness executes the production Java engine. */
public final class BusinessEngineCli {
    static final class Missing extends Exception{final String path;Missing(String path){this.path=path;}}
    public static void main(String[] args)throws Exception{
        BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=reader.readLine())!=null){JSONObject response=new JSONObject(),input=null;try{
            input=new JSONObject(line);JSONObject docs=input.getJSONObject("documents");Map<String,JSONObject> writes=new LinkedHashMap<>();
            BusinessEngine.Tx tx=new BusinessEngine.Tx(){public JSONObject get(String path)throws Exception{if(!docs.has(path))throw new Missing(path);return docs.isNull(path)?null:new JSONObject(docs.getJSONObject(path).toString());}public void put(String path,JSONObject value){writes.put(path,value);}};
            JSONObject result=input.has("collection")?BusinessEngine.importRecord(tx,input.getString("uid"),input.getString("collection"),input.getJSONObject("record"),input.getString("now")):BusinessEngine.execute(tx,input.getString("uid"),input.getJSONObject("operation"),input.getString("now"));response.put("result",result).put("writes",new JSONObject(writes));
        }catch(Missing missing){response.put("need",missing.path);}catch(Exception error){response.put("error",error.getMessage()).put("code",error instanceof BusinessEngine.Problem?((BusinessEngine.Problem)error).code:"validation").put("definitive",true);}
        response.put("request",input==null?0:input.optInt("request"));System.out.println(response);System.out.flush();}
    }
}
