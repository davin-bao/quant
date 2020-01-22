// 定义类
class Marketplace {
    //构造函数
    constructor(market) {
        this.SUPPORT_MARKET = [
            'eth_usdt',
            'zrx_btc',
            'qtum_btc',
            'xem_usdt',
            'snt_usdt',
            'trx_usdt',
            'bat_usdt',
            'dash_usdt',
            'ada_usdt',
            'xrp_usdt',
            'omg_usdt',
            'btc_usdt',
            'doge_usdt',
            'gnt_usdt',
            'neo_btc',
            'ltc_btc',
            'xlm_usdt',
            'mana_btc',
            'gnt_btc',
            'neo_usdt',
            'xtz_usdt',
            'ada_btc',
            'kan_btc',
            'eos_usdt',
            'bcx_btc',
            'btm_usdt',
            'snt_btc',
            'xmr_usdt',
            'eth_btc',
            'dash_btc',
            'zrx_usdt',
            'xem_btc',
            'xrp_btc',
            'omg_btc',
            'hc_usdt',
            'eos_btc',
            'bts_btc',
            'doge_btc',
            'bat_btc',
            'vsys_btc',
            'trx_btc',
            'qtum_usdt',
            'etc_usdt',
            'etc_btc',
            'ltc_usdt',
            'xlm_btc',
            'mana_usdt',
            'btm_btc',
            'ae_btc',
            'hc_btc',
            'icx_btc',
            'xlm_eth',
            'tnb_eth',
            'mds_eth',
            'eos_eth',
            'xmx_eth',
            'knc_eth',
            'ada_eth',
            'uip_eth',
            'zec_btc',
            'ruff_eth',
            'omg_eth',
            'xmx_btc',
            'mt_eth',
            'trx_eth',
            'zrx_eth',
            'qtum_eth',
            'bcd_btc',
            'zil_eth',
            'ltc_eth',
            'pra_eth',
            'lrc_eth',
            'snt_eth',
            'xrp_eth',
            'zec_eth',
            'true_btc',
            'leo_usdt',
            'pax_usdt',
            'tusd_usdt',
            'mco_usdt',
            'bcd_usdt',
            'edo_usdt',
            'knc_usdt',
            'icx_usdt',
            'ubtc_usdt',
            'topc_usdt',
            'qun_usdt',
            'true_usdt',
            'chat_usdt',
            'neo_eth',
            'bchabc_usdt',
            'bchsv_usdt',
            'gnx_btc',
            'aac_btc',
            'nuls_usdt',
            'algo_eth',
            'snc_eth',
            'elf_usdt',
            'act_btc',
            'iota_usdt',
            'cmt_eth',
            'dcr_usdt',
            'zen_eth',
            'soc_btc',
            'mco_btc',
            'nas_usdt',
            'kcash_eth',
            'iost_eth',
            'trio_eth',
            'dgd_btc',
            'ctxc_usdt',
            'ae_usdt',
            'cvc_eth',
            'atom_eth',
            'gas_btc',
            'ardr_btc',
            'lba_btc',
            'swftc_eth',
            'zil_usdt',
            'qun_btc',
            'ont_usdt',
            'ont_eth',
            'wtc_eth',
            'link_btc',
            'xmr_btc',
            'topc_eth',
            'lsk_btc',
            'iost_usdt',
            'waves_usdt',
            'act_eth',
            'aac_eth',
            'algo_btc',
            'cmt_btc',
            'trio_btc',
            'waves_btc',
            'bsv_btc',
            'kcash_btc',
            'btt_btc',
            'lamb_usdt',
            'ont_btc',
            'cro_usdt',
            'link_eth',
            'dgb_eth',
            'nas_btc',
            'dgd_eth',
            'bch_btc',
            'nano_eth',
            'btt_usdt',
            'nano_usdt',
            'wtc_btc',
            'swftc_btc',
            'wxt_btc',
            'xmr_eth',
            'itc_btc',
            'dcr_btc',
            'wtc_usdt',
            'chat_btc',
            'let_btc',
            'mana_eth',
            'link_usdt',
            'vsys_usdt',
            'elf_btc',
            'atom_usdt',
            'btg_btc',
            'btt_eth',
            'fair_eth',
            'bch_usdt',
            'nuls_btc',
            'btm_eth',
            'lsk_eth',
            'iota_btc',
            'waves_eth',
            'dgb_btc',
            'nuls_eth',
            'knc_btc',
            'soc_usdt',
            'wxt_usdt',
            'itc_usdt',
            'egt_btc',
            'hc_eth',
            'nano_btc',
            'nas_eth',
            'sc_btc',
            'abt_eth',
            'algo_usdt',
            'icx_eth',
            'act_usdt',
            'lba_usdt',
            'cvc_usdt',
            'kan_usdt',
            'gnx_eth',
            'zil_btc',
            'cmt_usdt',
            'snc_btc',
            'bsv_usdt',
            'theta_btc',
            'cvc_btc',
            'ctxc_eth',
            'sbtc_btc',
            'iost_btc',
            'elf_eth',
            'mco_eth',
            'iota_eth',
            'dcr_eth',
            'ae_eth',
            'zen_btc',
            'pay_btc',
            'fsn_usdt',
            'atom_btc',
            'kan_eth',
            'gas_eth',
            'zec_usdt',
            'ctxc_btc',
            'let_usdt',
            'abt_btc',
            'qun_eth',
            'theta_usdt',
            'storj_usdt',
            'sc_eth',
            'egt_usdt',
    ];

        // if(this.SUPPORT_MARKET.indexOf(market) < 0){
        //     throw new Error('不支持的市场')
        // }
        this.market = market;
    }
}
//静态变量
// Marketplace.para = 'Allen';
exports = module.exports = Marketplace;
