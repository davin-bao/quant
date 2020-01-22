AUTH(function($) {
    const cookie = $.cookie('__user');
    $.roles(cookie);
    $.success({ name: cookie });
    return;
});