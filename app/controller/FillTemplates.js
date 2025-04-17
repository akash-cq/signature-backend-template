import {createReport} from "docx-templates";

export const FillTemplate = async (content,entry) => {
    try{
        const buffer = await createReport({
          template: content,
          data: entry,
          cmdDelimiter: ["{", "}"],
          failFast: false,
          fixSmartQuotes: false,
          rejectNullish: false,
        });
        return buffer;
    }catch(err){
        console.log(err," error")
        throw new Error(err);
    }
}
