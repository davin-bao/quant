$(document).ready(function() {

});

function toFixed(field, digits){
    if(parseInt(field) === NaN){
        return 0;
    }
    return parseFloat(field).toFixed(digits);
}