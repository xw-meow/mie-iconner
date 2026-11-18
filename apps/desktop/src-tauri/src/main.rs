fn main() {
    if mie_iconner_lib::run_admin_helper_if_requested() {
        return;
    }
    mie_iconner_lib::run()
}
